import * as vscode from "vscode";
import { PreviewController } from "./previewController.ts";

let controller: PreviewController | undefined;

export function activate(context: vscode.ExtensionContext): void {
  controller = new PreviewController(context);
  context.subscriptions.push(controller);
}

export function deactivate(): void {
  controller?.dispose();
  controller = undefined;
}
