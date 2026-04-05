// Global browser API type augmentations

interface DragDataPayload {
  placeId?: string;
  assignmentId?: string;
  noteId?: string;
  fromDayId?: string;
}

declare global {
  interface Window {
    __dragData: DragDataPayload | null;
  }
}

export {};
