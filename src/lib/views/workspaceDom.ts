// Where the editor groups and tab contents are in the page, for code that finds an editor from the DOM (Quick Open,
// the performance probes) and for screenshots. The UI library's SplitGrid marks the focused group with
// aria-current; each tab's content is an ElementHost named "Tab content" with the hidden attribute while another
// tab of its group shows.
export const TAB_CONTENT = '[role="group"][aria-label="Tab content"]';
export const SHOWN_TAB_CONTENT = `${TAB_CONTENT}:not([hidden])`;
export const FOCUSED_GROUP = 'section[aria-current="true"]';
