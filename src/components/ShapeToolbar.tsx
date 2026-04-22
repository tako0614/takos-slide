interface ShapeToolbarProps {
  onInsertText: () => void;
  onInsertShape: (shape: "rect" | "ellipse" | "triangle" | "arrow") => void;
  onInsertImage: () => void;
  onDelete: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onPresent: () => void;
  canUndo: boolean;
  canRedo: boolean;
  hasSelection: boolean;
  presentationTitle: string;
  onTitleChange: (title: string) => void;
}

function ToolButton(props: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "danger" | "primary";
}) {
  const variant = () => props.variant ?? "default";
  return (
    <button
      type="button"
      class="px-3 py-1.5 text-xs font-medium rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      classList={{
        "bg-gray-700 hover:bg-gray-600 text-gray-200": variant() === "default",
        "bg-red-700/60 hover:bg-red-600/80 text-red-200":
          variant() === "danger",
        "bg-blue-600 hover:bg-blue-500 text-white": variant() === "primary",
      }}
      onClick={() => props.onClick()}
      disabled={props.disabled}
    >
      {props.label}
    </button>
  );
}

export default function ShapeToolbar(props: ShapeToolbarProps) {
  return (
    <div class="h-12 bg-gray-800 border-b border-gray-700 flex items-center px-4 gap-2">
      {/* Title */}
      <input
        class="bg-transparent text-sm font-semibold text-gray-100 border-none outline-none hover:bg-gray-700 focus:bg-gray-700 px-2 py-1 rounded w-48 transition-colors"
        value={props.presentationTitle}
        onInput={(e) => props.onTitleChange(e.currentTarget.value)}
      />

      <div class="w-px h-6 bg-gray-600 mx-2" />

      {/* Insert tools */}
      <span class="text-xs text-gray-500 mr-1">Insert:</span>
      <ToolButton label="Text" onClick={() => props.onInsertText()} />
      <ToolButton
        label="Rect"
        onClick={() => props.onInsertShape("rect")}
      />
      <ToolButton
        label="Ellipse"
        onClick={() => props.onInsertShape("ellipse")}
      />
      <ToolButton
        label="Triangle"
        onClick={() => props.onInsertShape("triangle")}
      />
      <ToolButton
        label="Arrow"
        onClick={() => props.onInsertShape("arrow")}
      />
      <ToolButton label="Image" onClick={() => props.onInsertImage()} />

      <div class="w-px h-6 bg-gray-600 mx-2" />

      {/* Edit tools */}
      <ToolButton
        label="Undo"
        onClick={() => props.onUndo()}
        disabled={!props.canUndo}
      />
      <ToolButton
        label="Redo"
        onClick={() => props.onRedo()}
        disabled={!props.canRedo}
      />
      <ToolButton
        label="Delete"
        onClick={() => props.onDelete()}
        disabled={!props.hasSelection}
        variant="danger"
      />

      <div class="flex-1" />

      {/* Present */}
      <ToolButton
        label="Present"
        onClick={() => props.onPresent()}
        variant="primary"
      />
    </div>
  );
}
