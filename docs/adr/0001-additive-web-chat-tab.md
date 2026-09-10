# Additive Web Chat Tab for Upstream Mergeability

Rather than modifying or replacing the upstream PTY-based `ChatPage.tsx`, the native React Web Chat is added as an incremental, standalone route and tab. This ensures the fork can cleanly rebase and merge future updates from upstream `main` without merge conflicts, while giving users the flexibility to switch between native Web Chat and the classic TUI.
