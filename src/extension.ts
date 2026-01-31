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

const MAX_HISTORY_SIZE = 100;
const STORAGE_KEY_BACK = 'caretHistory.backStack';
const STORAGE_KEY_FORWARD = 'caretHistory.forwardStack';
const STORAGE_KEY_LAST = 'caretHistory.lastPosition';

let extensionContext: vscode.ExtensionContext;

function saveHistory() {
	extensionContext.workspaceState.update(STORAGE_KEY_BACK, backStack.slice(-MAX_HISTORY_SIZE));
	extensionContext.workspaceState.update(STORAGE_KEY_FORWARD, forwardStack.slice(-MAX_HISTORY_SIZE));
	extensionContext.workspaceState.update(STORAGE_KEY_LAST, lastPosition);
}

function loadHistory() {
	backStack = extensionContext.workspaceState.get<CaretPosition[]>(STORAGE_KEY_BACK) || [];
	forwardStack = extensionContext.workspaceState.get<CaretPosition[]>(STORAGE_KEY_FORWARD) || [];
	lastPosition = extensionContext.workspaceState.get<CaretPosition | null>(STORAGE_KEY_LAST) || null;
}

export function activate(context: vscode.ExtensionContext) {
	console.log('Caret History extension activated');

	extensionContext = context;
	loadHistory();

	// Cursor movement listener
	const selectionListener = vscode.window.onDidChangeTextEditorSelection((e: vscode.TextEditorSelectionChangeEvent) => {
		if (isNavigating) {
			return;
		}

		const editor = e.textEditor;
		const selection = editor.selection;

		// Skip if text is being selected (not just cursor movement)
		if (!selection.isEmpty) {
			return;
		}

		const pos = selection.active;

		const current: CaretPosition = {
			uri: editor.document.uri.toString(),
			line: pos.line,
			character: pos.character
		};

		// Skip if same position
		if (
			lastPosition &&
			lastPosition.uri === current.uri &&
			lastPosition.line === current.line &&
			lastPosition.character === current.character
		) {
			return;
		}

		// Skip if same file and same line (only character changed)
		if (
			lastPosition &&
			lastPosition.uri === current.uri &&
			lastPosition.line === current.line
		) {
			// Update lastPosition but don't add to history
			lastPosition = current;
			return;
		}

		if (lastPosition) {
			backStack.push(lastPosition);
			forwardStack = []; // New movement clears forward stack
		}

		lastPosition = current;
		saveHistory();
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
				ed.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenterIfOutsideViewport);

				lastPosition = target;
				saveHistory();
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
				ed.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenterIfOutsideViewport);

				lastPosition = target;
				saveHistory();
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
			saveHistory();
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
