//! Interactive rebase of a range with merge commits (`git rebase -i --rebase-merges`).
//!
//! The todo is laid out like git's own: `label onto`, then one segment per branch that
//! starts with `reset`, holds `pick` lines, `label`s the commits other segments reset to or
//! merge, and recreates merges with `merge -C`. The dialog may change the action of each
//! pick, reorder picks only inside a run (picks between two structural lines), and pick or
//! drop a merge as a unit: a dropped merge also drops the segments that only fed it.

use std::collections::{HashMap, HashSet};
use std::path::Path;

use git2::{Oid, Repository};
use serde::Serialize;

use super::rebase::{parse_commit_id, RebaseAction, RebaseEntry, TodoWriter};
use crate::error::{AppError, AppResult};

pub const ROOT_REFUSAL: &str = "Rebasing merge commits from the root commit is not supported: start from a later commit";

const ONTO: &str = "onto";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum StepKind {
    Label,
    Reset,
    Pick,
    Merge,
}

/// One line of the todo.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RebaseStep {
    pub kind: StepKind,
    /// Pick and merge: the commit. Reset: the commit it resets to when that is not a label
    /// (a branch point outside the range, which stays where it is).
    pub commit_id: Option<String>,
    /// Label: its name. Reset: the label it resets to.
    pub label: Option<String>,
    /// Merge: the labels of the parents merged in, or commit ids for parents outside the range.
    pub parents: Vec<String>,
}

impl RebaseStep {
    fn label(name: &str) -> RebaseStep {
        RebaseStep {
            kind: StepKind::Label,
            commit_id: None,
            label: Some(name.to_string()),
            parents: Vec::new(),
        }
    }

    fn commit(kind: StepKind, oid: Oid) -> RebaseStep {
        RebaseStep {
            kind,
            commit_id: Some(oid.to_string()),
            label: None,
            parents: Vec::new(),
        }
    }
}

fn label_name(oid: Oid) -> String {
    format!("gm-{}", &oid.to_string()[..12])
}

/// The todo for `commits` (base..head, oldest first), like `git rebase -i --rebase-merges base`.
pub fn layout(repo: &Repository, head: Oid, base: Oid, commits: &[Oid]) -> AppResult<Vec<RebaseStep>> {
    let interesting: HashSet<Oid> = commits.iter().copied().collect();
    let mut parents: HashMap<Oid, Vec<Oid>> = HashMap::new();
    for &oid in commits {
        parents.insert(oid, repo.find_commit(oid)?.parent_ids().collect());
    }
    // Where the rebased history starts: the base, or a merge base with it (a diverged upstream).
    let mut onto_points: HashSet<Oid> = HashSet::from([base]);
    if let Ok(bases) = repo.merge_bases(base, head) {
        onto_points.extend(bases.iter().copied());
    }

    let mut labels: HashMap<Oid, String> = HashMap::new();
    let mut tips: Vec<Oid> = Vec::new();
    for oid in commits {
        for &parent in parents[oid].iter().skip(1) {
            if interesting.contains(&parent) && !tips.contains(&parent) {
                tips.push(parent);
                labels.insert(parent, label_name(parent));
            }
        }
    }
    // A commit with two children in the range is where a later segment resets to.
    let mut children: HashMap<Oid, usize> = HashMap::new();
    for oid in commits {
        for parent in &parents[oid] {
            if interesting.contains(parent) {
                *children.entry(*parent).or_default() += 1;
            }
        }
    }
    for (oid, count) in children {
        if count > 1 {
            labels.entry(oid).or_insert_with(|| label_name(oid));
        }
    }
    tips.push(head);

    let mut steps = vec![RebaseStep::label(ONTO)];
    let mut shown: HashSet<Oid> = HashSet::new();
    for tip in tips {
        if shown.contains(&tip) {
            continue;
        }
        let mut segment = Vec::new();
        let mut cursor = Some(tip);
        while let Some(oid) = cursor.filter(|oid| interesting.contains(oid) && !shown.contains(oid)) {
            segment.push(oid);
            cursor = parents[&oid].first().copied();
        }
        segment.reverse();
        let start = cursor.ok_or_else(|| AppError::invalid(ROOT_REFUSAL))?;
        let reset = if let Some(label) = labels.get(&start) {
            RebaseStep {
                label: Some(label.clone()),
                ..RebaseStep::commit(StepKind::Reset, start)
            }
        } else if onto_points.contains(&start) {
            RebaseStep {
                kind: StepKind::Reset,
                commit_id: None,
                label: Some(ONTO.to_string()),
                parents: Vec::new(),
            }
        } else if interesting.contains(&start) {
            // Every shown commit another segment continues from has a label; anything else
            // would make a wrong todo, so refuse instead.
            return Err(AppError::invalid("This history cannot be laid out for an interactive rebase"));
        } else {
            RebaseStep::commit(StepKind::Reset, start)
        };
        steps.push(reset);
        for oid in segment {
            let merged: Vec<Oid> = parents[&oid].iter().skip(1).copied().collect();
            if merged.is_empty() {
                steps.push(RebaseStep::commit(StepKind::Pick, oid));
            } else {
                let mut parent_names = Vec::new();
                for parent in merged {
                    if interesting.contains(&parent) && !shown.contains(&parent) {
                        return Err(AppError::invalid("This history cannot be laid out for an interactive rebase"));
                    }
                    parent_names.push(labels.get(&parent).cloned().unwrap_or_else(|| parent.to_string()));
                }
                steps.push(RebaseStep {
                    parents: parent_names,
                    ..RebaseStep::commit(StepKind::Merge, oid)
                });
            }
            if let Some(label) = labels.get(&oid) {
                steps.push(RebaseStep::label(label));
            }
            shown.insert(oid);
        }
    }
    Ok(steps)
}

/// Index ranges of the segments: the prelude (`label onto`), then one per `reset`.
fn segments(steps: &[RebaseStep]) -> Vec<std::ops::Range<usize>> {
    let mut starts: Vec<usize> = vec![0];
    for (index, step) in steps.iter().enumerate() {
        if step.kind == StepKind::Reset && index > 0 {
            starts.push(index);
        }
    }
    starts
        .iter()
        .enumerate()
        .map(|(position, &start)| start..starts.get(position + 1).copied().unwrap_or(steps.len()))
        .filter(|range| !range.is_empty())
        .collect()
}

/// Which steps go into the todo: the prelude, the segment ending at HEAD, and every
/// segment a kept segment resets to or merges. `dropped` holds the dropped merge commits.
pub fn live_steps(steps: &[RebaseStep], dropped: &HashSet<String>) -> Vec<bool> {
    let ranges = segments(steps);
    let mut defined_in: HashMap<&str, usize> = HashMap::new();
    for (segment, range) in ranges.iter().enumerate() {
        for step in &steps[range.clone()] {
            if let (StepKind::Label, Some(label)) = (step.kind, step.label.as_deref()) {
                defined_in.insert(label, segment);
            }
        }
    }
    let mut live = vec![false; ranges.len()];
    let mut pending: Vec<usize> = vec![0];
    if ranges.len() > 1 {
        pending.push(ranges.len() - 1);
    }
    while let Some(segment) = pending.pop() {
        if live[segment] {
            continue;
        }
        live[segment] = true;
        for step in &steps[ranges[segment].clone()] {
            let used: Vec<&str> = match step.kind {
                StepKind::Reset => step.label.as_deref().into_iter().collect(),
                StepKind::Merge if !dropped.contains(step.commit_id.as_deref().unwrap_or_default()) => {
                    step.parents.iter().map(String::as_str).collect()
                }
                _ => Vec::new(),
            };
            for label in used {
                if let Some(&other) = defined_in.get(label) {
                    pending.push(other);
                }
            }
        }
    }
    let mut result = vec![false; steps.len()];
    for (segment, range) in ranges.iter().enumerate() {
        for index in range.clone() {
            result[index] = live[segment];
        }
    }
    result
}

/// The runs of consecutive picks, as step index ranges.
fn runs(steps: &[RebaseStep]) -> Vec<std::ops::Range<usize>> {
    let mut result = Vec::new();
    let mut index = 0;
    while index < steps.len() {
        if steps[index].kind != StepKind::Pick {
            index += 1;
            continue;
        }
        let start = index;
        while index < steps.len() && steps[index].kind == StepKind::Pick {
            index += 1;
        }
        result.push(start..index);
    }
    result
}

fn dropped_merges(steps: &[RebaseStep], entries: &[RebaseEntry]) -> HashSet<String> {
    let merges: HashSet<&str> = steps
        .iter()
        .filter(|step| step.kind == StepKind::Merge)
        .filter_map(|step| step.commit_id.as_deref())
        .collect();
    entries
        .iter()
        .filter(|entry| entry.action == RebaseAction::Drop && merges.contains(entry.commit_id.trim()))
        .map(|entry| entry.commit_id.trim().to_string())
        .collect()
}

/// The run's entries in the dialog's order (it may only reorder inside a run).
fn run_entries<'a>(steps: &[RebaseStep], run: &std::ops::Range<usize>, entries: &'a [RebaseEntry]) -> Vec<&'a RebaseEntry> {
    let members: HashSet<&str> = steps[run.clone()].iter().filter_map(|step| step.commit_id.as_deref()).collect();
    entries.iter().filter(|entry| members.contains(entry.commit_id.trim())).collect()
}

/// Checks the entries against the layout (the commit set itself is checked by the caller).
pub fn validate(steps: &[RebaseStep], entries: &[RebaseEntry]) -> AppResult<()> {
    for entry in entries {
        parse_commit_id(&entry.commit_id)?;
    }
    let merges: HashSet<&str> = steps
        .iter()
        .filter(|step| step.kind == StepKind::Merge)
        .filter_map(|step| step.commit_id.as_deref())
        .collect();
    for entry in entries {
        let is_merge = merges.contains(entry.commit_id.trim());
        if is_merge && !matches!(entry.action, RebaseAction::Pick | RebaseAction::Drop) {
            return Err(AppError::invalid("A merge commit can only be picked or dropped"));
        }
    }
    let live = live_steps(steps, &dropped_merges(steps, entries));
    let mut kept = 0;
    for run in runs(steps) {
        if !live[run.start] {
            continue;
        }
        let ordered = run_entries(steps, &run, entries);
        match ordered.iter().find(|entry| entry.action != RebaseAction::Drop) {
            Some(entry) if !entry.action.keeps_commit() => {
                return Err(AppError::invalid(
                    "A squash or fixup needs a commit above it on the same branch",
                ));
            }
            Some(_) => kept += 1,
            None => {}
        }
    }
    let kept_merges = steps
        .iter()
        .enumerate()
        .filter(|(index, step)| step.kind == StepKind::Merge && live[*index])
        .filter(|(_, step)| {
            let commit_id = step.commit_id.as_deref().unwrap_or_default();
            entries.iter().any(|entry| entry.commit_id.trim() == commit_id && entry.action == RebaseAction::Pick)
        })
        .count();
    if kept + kept_merges == 0 {
        return Err(AppError::invalid("Keep at least one commit"));
    }
    Ok(())
}

/// The todo lines for `steps` with the dialog's actions and order.
pub fn build_todo(dir: &Path, steps: &[RebaseStep], entries: &[RebaseEntry]) -> AppResult<Vec<String>> {
    let live = live_steps(steps, &dropped_merges(steps, entries));
    let mut writer = TodoWriter::new(dir);
    let mut index = 0;
    while index < steps.len() {
        let step = &steps[index];
        if !live[index] {
            index += 1;
            continue;
        }
        match step.kind {
            StepKind::Label => {
                writer.lines.push(format!("label {}", step.label.as_deref().unwrap_or(ONTO)));
            }
            StepKind::Reset => {
                let target = step.label.as_deref().or(step.commit_id.as_deref()).unwrap_or(ONTO);
                writer.lines.push(format!("reset {target}"));
            }
            StepKind::Merge => {
                let commit_id = step.commit_id.as_deref().unwrap_or_default();
                let picked = entries
                    .iter()
                    .any(|entry| entry.commit_id.trim() == commit_id && entry.action == RebaseAction::Pick);
                if picked {
                    writer.lines.push(format!("merge -C {commit_id} {}", step.parents.join(" ")));
                }
            }
            StepKind::Pick => {
                let run = index..runs(&steps[index..]).first().map_or(index + 1, |run| index + run.end);
                writer.write_run(&run_entries(steps, &run, entries))?;
                index = run.end;
                continue;
            }
        }
        index += 1;
    }
    Ok(writer.lines)
}
