import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { cn, themedBody } from "@/lib/utils";
import { WebChatSidebar, type WebChatSidebarProps } from "./WebChatSidebar";

interface WebChatSessionDrawerProps extends Omit<WebChatSidebarProps, "collapsed" | "onToggleCollapse" | "className"> {
  onClose: () => void;
}

export function WebChatSessionDrawer({ onClose, ...props }: WebChatSessionDrawerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current!;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);

  return createPortal(
    <dialog
      ref={dialogRef}
      aria-label="会话列表"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) {
          onClose();
        }
      }}
      className={cn(themedBody, "fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-64 max-w-[calc(100vw-3rem)] border-0 bg-background p-0 text-foreground shadow-xl backdrop:bg-black/60")}
    >
      <WebChatSidebar {...props} onToggleCollapse={onClose} className="w-full" />
    </dialog>,
    document.body,
  );
}
