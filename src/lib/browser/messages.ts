import type { ReaderDocument, TextSelectionRect } from '../../models';

export type PopupAction = 'selection' | 'article' | 'scan';

export type ExtensionMessage =
  | { type: 'RUN_ACTION'; action: PopupAction; autoPlay?: boolean }
  | { type: 'QUERY_SELECTION' }
  | { type: 'GET_SELECTION_STATE' }
  | { type: 'SELECTION_STATE'; available: boolean }
  | { type: 'OPEN_SELECTION'; autoPlay?: boolean }
  | { type: 'OPEN_ARTICLE'; autoPlay?: boolean }
  | { type: 'START_OCR_SELECTION' }
  | { type: 'OCR_CAPTURE_REQUEST'; rect: TextSelectionRect }
  | { type: 'OCR_PROCESS'; image: string; rect: TextSelectionRect; language: string; tabId: number }
  | { type: 'OCR_PROGRESS'; progress: number; status: string; tabId: number }
  | { type: 'OCR_RESULT'; text: string; tabId: number }
  | { type: 'OCR_ERROR'; message: string; tabId: number }
  | { type: 'OCR_CANCEL' }
  | { type: 'OPEN_DOCUMENT'; document: ReaderDocument }
  | { type: 'SHOW_ERROR'; message: string };

export interface ActionResponse {
  ok: boolean;
  message?: string;
  selectionAvailable?: boolean;
}
