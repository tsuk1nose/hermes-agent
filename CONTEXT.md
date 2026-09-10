# Web Chat

Native browser-based conversation and session management surface for Hermes Agent, replacing the embedded terminal PTY with a Gemini/ChatGPT-style web interface.

## Language

**Web Chat**:
The native React conversation interface rendered in the browser, providing rich markdown streaming, tool inspection, and session switching.
_Avoid_: Dashboard terminal, PTY chat, Web CLI

**Chat Session**:
A discrete conversation lineage displayed in the sidebar and backed by the session database, supporting switching, renaming, deletion, and event replay.
_Avoid_: Chat tab, channel, room, thread

**Gateway Socket**:
The bidirectional WebSocket connection (`/api/ws`) between the browser and `tui_gateway`, carrying JSON-RPC methods, token deltas, and approval events.
_Avoid_: SSE stream, event stream, polling connection

**Tool Step Card**:
An inline collapsible element in the message stream representing an agent tool call (e.g. bash command, file edit), expandable to view raw stdout, stderr, or diffs.
_Avoid_: Terminal pane, drawer inspector, console overlay

**Approval Card**:
An interactive inline widget within the conversation stream that prompts the user to approve or deny a sensitive tool execution.
_Avoid_: CLI prompt, modal confirmation, sudo dialog

**Thinking Block**:
A collapsible section at the head of an assistant turn displaying reasoning tokens from thinking models.
_Avoid_: Chain-of-thought dump, hidden reasoning

**Composer**:
The bottom interaction bar providing auto-expanding text input, generation interrupt controls, slash command completion, and multi-modal attachment previews.
_Avoid_: Command line, prompt input, terminal buffer

**Prompt Starter**:
A quick-action chip on the empty session landing hero that pre-fills the composer with common agent tasks.
_Avoid_: Template, macro, shortcut button
