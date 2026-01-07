import * as vscode from 'vscode';

interface CaretPosition {
	uri: string;
	line: number;
	character: number;
}

let backStack: CaretPosition[] = [];
let forwardStack: CaretPosition[] = [];
let lastPosition: CaretPosition | null = null;
let isNavigating = false;

// Minimum line distance - filter out small movements
const MIN_LINE_DISTANCE = 5;

export function activate(context: vscode.ExtensionContext) {
	console.log('Caret History extension activated');

	// Cursor movement listener
	const selectionListener = vscode.window.onDidChangeTextEditorSelection((e: vscode.TextEditorSelectionChangeEvent) => {
		if (isNavigating) {
			return;
		}

		const editor = e.textEditor;
		const pos = editor.selection.active;

		const current: CaretPosition = {
			uri: editor.document.uri.toString(),
			line: pos.line,
			character: pos.character
		};

		// Are we at the same position?
		if (
			lastPosition &&
			lastPosition.uri === current.uri &&
			lastPosition.line === current.line &&
			lastPosition.character === current.character
		) {
			return;
		}

		// Filter small movements (less than MIN_LINE_DISTANCE in the same file)
		if (
			lastPosition &&
			lastPosition.uri === current.uri &&
			Math.abs(lastPosition.line - current.line) < MIN_LINE_DISTANCE
		) {
			// Only update lastPosition, don't add to stack
			lastPosition = current;
			return;
		}

		if (lastPosition) {
			backStack.push(lastPosition);
			forwardStack = []; // New movement clears forward stack
		}

		lastPosition = current;
	});

	// Go Back command - hybrid: caret first, then VS Code
	const goBack = vscode.commands.registerCommand(
		'caretHistory.back',
		async () => {
			// Fall back to VS Code history if caret stack is empty
			if (backStack.length === 0) {
				await vscode.commands.executeCommand('workbench.action.navigateBack');
				return;
			}

			const target = backStack.pop()!;
			const editor = vscode.window.activeTextEditor;
			if (!editor) {
				return;
			}

			isNavigating = true;

			try {
				const uri = vscode.Uri.parse(target.uri);

				// Check if file exists before trying to open
				try {
					await vscode.workspace.fs.stat(uri);
				} catch {
					// File doesn't exist, skip to next entry
					isNavigating = false;
					await vscode.commands.executeCommand('caretHistory.back');
					return;
				}

				if (lastPosition) {
					forwardStack.push(lastPosition);
				}

				const doc = await vscode.workspace.openTextDocument(uri);
				const ed = await vscode.window.showTextDocument(doc);

				const pos = new vscode.Position(target.line, target.character);
				ed.selection = new vscode.Selection(pos, pos);
				ed.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);

				lastPosition = target;
			} finally {
				isNavigating = false;
			}
		}
	);

	// Go Forward command - hybrid: caret first, then VS Code
	const goForward = vscode.commands.registerCommand(
		'caretHistory.forward',
		async () => {
			// Fall back to VS Code history if caret stack is empty
			if (forwardStack.length === 0) {
				await vscode.commands.executeCommand('workbench.action.navigateForward');
				return;
			}

			const target = forwardStack.pop()!;

			isNavigating = true;

			try {
				const uri = vscode.Uri.parse(target.uri);

				// Check if file exists before trying to open
				try {
					await vscode.workspace.fs.stat(uri);
				} catch {
					// File doesn't exist, skip to next entry
					isNavigating = false;
					await vscode.commands.executeCommand('caretHistory.forward');
					return;
				}

				if (lastPosition) {
					backStack.push(lastPosition);
				}

				const doc = await vscode.workspace.openTextDocument(uri);
				const ed = await vscode.window.showTextDocument(doc);

				const pos = new vscode.Position(target.line, target.character);
				ed.selection = new vscode.Selection(pos, pos);
				ed.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);

				lastPosition = target;
			} finally {
				isNavigating = false;
			}
		}
	);

	// Clear history command (for debugging)
	const clearHistory = vscode.commands.registerCommand(
		'caretHistory.clear',
		() => {
			backStack = [];
			forwardStack = [];
			lastPosition = null;
			vscode.window.showInformationMessage('Caret history cleared');
		}
	);

	context.subscriptions.push(selectionListener, goBack, goForward, clearHistory);
}

export function deactivate() {
	backStack = [];
	forwardStack = [];
	lastPosition = null;
}
