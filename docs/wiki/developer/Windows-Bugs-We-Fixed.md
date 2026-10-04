# Windows Bugs We Fixed

The bugs the Windows CI job found, why they happened and how we fixed them. How Windows support works is on [Windows Support](Windows-Support.md).

**Local History refused every file on Windows.** `check_file_path` wanted the path to start with `/`, so a `C:/...` path was "invalid" and no snapshot was ever written. The Windows CI run showed it. Now `paths::after_root` accepts `/` or, on Windows, a drive root, and the rest of the check is unchanged, so `.` and `..` parts are still refused.

**A rooted path could leave the work tree on Windows.** `safe_join` and the submodule path check refused absolute paths with `is_absolute()`. On Windows `\etc\passwd` has a root but no drive, so it is not "absolute", and joining it onto the repository gives a path at the drive root. Both checks now also refuse `Component::RootDir`, like the MCP path check already did.
