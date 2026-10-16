// What a Navigation Bar list holds: a folder's entries read from disk (or the workspace's folders for the
// workspace crumb), with loading, error and "more than 5000" states. Only the latest read is kept.
import { api, errorMessage } from "$lib/api";
import { folderFor, type FolderRef, relativeTo } from "$lib/stores/workspacePaths";
import { folderItems, itemsOf, type NavCrumb, type NavItem } from "./navBarModel";

export class NavListing {
  items = $state.raw<NavItem[]>([]);
  loading = $state(false);
  loadError = $state<string | null>(null);
  truncated = $state(false);
  #request = 0;

  /** `shown` runs with the entries once they are in, to pick the row to select. */
  constructor(private readonly shown: (items: NavItem[]) => void) {}

  /** Forgets the list and drops a read still on its way. */
  clear(): void {
    this.#request += 1;
    this.items = [];
    this.loadError = null;
    this.loading = false;
  }

  async load(crumb: NavCrumb | undefined, folders: FolderRef[], repoRoots: ReadonlySet<string>): Promise<void> {
    const request = ++this.#request;
    this.loadError = null;
    this.truncated = false;
    if (!crumb) {
      this.items = [];
      return;
    }
    if (crumb.kind === "workspace") {
      this.#show(folderItems(folders, repoRoots));
      return;
    }
    const folder = folderFor(folders, crumb.path);
    if (!folder) {
      this.items = [];
      this.loadError = "This folder is not in the workspace.";
      return;
    }
    this.loading = true;
    try {
      const relative = relativeTo(folder.root, crumb.path);
      const [listing] = await api.listDirectories(folder.root, [relative], [...repoRoots]);
      if (request !== this.#request) {
        return;
      }
      if (!listing || listing.error) {
        this.items = [];
        this.loadError = listing?.error ?? "Could not read this folder.";
      } else {
        this.truncated = listing.truncated;
        this.#show(itemsOf(crumb.path, listing.entries ?? []));
      }
    } catch (error) {
      if (request === this.#request) {
        this.items = [];
        this.loadError = errorMessage(error);
      }
    } finally {
      if (request === this.#request) {
        this.loading = false;
      }
    }
  }

  #show(items: NavItem[]): void {
    this.items = items;
    this.shown(items);
  }
}
