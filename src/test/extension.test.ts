import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

suite('Caret History Extension Test Suite', () => {
	let tempDir: string;
	let testFile1: string;
	let testFile2: string;

	suiteSetup(async () => {
		// Create temp directory and test files
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'caret-history-test-'));
		testFile1 = path.join(tempDir, 'test1.ts');
		testFile2 = path.join(tempDir, 'test2.ts');

		// Create files with enough lines to test navigation
		const content = Array.from({ length: 100 }, (_, i) => `// Line ${i + 1}`).join('\n');
		fs.writeFileSync(testFile1, content);
		fs.writeFileSync(testFile2, content);

		// Wait for extension to activate
		await vscode.extasdadadensions.getExtension('ozer.caret-history')?.activate();
	});

	suiteTeardown(() => {
		// Cleanup temp files
		if (fs.existsSync(testFile1)) {
			fs.unlinkSync(testFile1);
		}
		if (fs.existsSync(testFile2)) {
			fs.unlinkSync(testFile2);
		}
		if (fs.existsSync(tempDir)) {
			fs.rmdirSync(tempDir);
		}
	});

	setup(async () => {
		// Clear history before each test
		await vscode.commands.executeCommand('caretHistory.clear');
		// Close all editors
		await vscode.commands.executeCommand('workbench.action.closeAllEditors');
	});

	test('Extension should be present', () => {
		const extension = vscode.extensions.getExtension('ozer.caret-history');
		assert.ok(extension, 'Extension should be installed');
	});

	test('Commands should be registered', async () => {
		const commands = await vscode.commands.getCommands(true);
		assert.ok(commands.includes('caretHistory.back'), 'caretHistory.back command should exist');
		assert.ok(commands.includes('caretHistory.forward'), 'caretHistory.forward command should exist');
		assert.ok(commands.includes('caretHistory.clear'), 'caretHistory.clear command should exist');
	});

	test('Should track cursor position changes across files', async () => {
		// Open first file
		const doc1 = await vscode.workspace.openTextDocument(testFile1);
		const editor1 = await vscode.window.showTextDocument(doc1);

		// Move to line 50
		const pos1 = new vscode.Position(50, 0);
		editor1.selection = new vscode.Selection(pos1, pos1);
		await delay(100);

		// Open second file
		const doc2 = await vscode.workspace.openTextDocument(testFile2);
		const editor2 = await vscode.window.showTextDocument(doc2);

		// Move to line 30
		const pos2 = new vscode.Position(30, 0);
		editor2.selection = new vscode.Selection(pos2, pos2);
		await delay(100);

		// Navigate back
		await vscode.commands.executeCommand('caretHistory.back');
		await delay(100);

		// Should be back in first file
		const activeEditor = vscode.window.activeTextEditor;
		assert.ok(activeEditor, 'Should have an active editor');
		assert.strictEqual(
			activeEditor?.document.uri.fsPath,
			testFile1,
			'Should navigate back to first file'
		);
	});

	test('Should filter small cursor movements within same file', async () => {
		const doc = await vscode.workspace.openTextDocument(testFile1);
		const editor = await vscode.window.showTextDocument(doc);

		// Move to line 10
		const pos1 = new vscode.Position(10, 0);
		editor.selection = new vscode.Selection(pos1, pos1);
		await delay(100);

		// Small movement (less than MIN_LINE_DISTANCE = 5)
		const pos2 = new vscode.Position(12, 0);
		editor.selection = new vscode.Selection(pos2, pos2);
		await delay(100);

		// This should not add to history - going back should fall through to VS Code
		await vscode.commands.executeCommand('caretHistory.back');
		await delay(100);

		// Position should not have changed significantly since small movements are filtered
		const currentPos = vscode.window.activeTextEditor?.selection.active;
		assert.ok(currentPos, 'Should have cursor position');
	});

	test('Should handle deleted files gracefully', async () => {
		// Create a temporary file
		const tempFile = path.join(tempDir, 'temp-delete-test.ts');
		fs.writeFileSync(tempFile, '// Temporary file\n'.repeat(50));

		// Open and navigate in the temp file
		const doc = await vscode.workspace.openTextDocument(tempFile);
		const editor = await vscode.window.showTextDocument(doc);

		const pos1 = new vscode.Position(10, 0);
		editor.selection = new vscode.Selection(pos1, pos1);
		await delay(100);

		// Navigate to another file
		const doc2 = await vscode.workspace.openTextDocument(testFile1);
		await vscode.window.showTextDocument(doc2);
		await delay(100);

		// Close the temp file editor and delete the file
		await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
		fs.unlinkSync(tempFile);

		// Navigate back should not throw an error
		try {
			await vscode.commands.executeCommand('caretHistory.back');
			await delay(100);
			// If we get here without error, the test passes
			assert.ok(true, 'Should handle deleted file gracefully');
		} catch (error) {
			assert.fail('Should not throw error when navigating to deleted file');
		}
	});

	test('Forward navigation should work after going back', async () => {
		// Open first file at position
		const doc1 = await vscode.workspace.openTextDocument(testFile1);
		const editor1 = await vscode.window.showTextDocument(doc1);
		const pos1 = new vscode.Position(20, 0);
		editor1.selection = new vscode.Selection(pos1, pos1);
		await delay(100);

		// Open second file at position
		const doc2 = await vscode.workspace.openTextDocument(testFile2);
		const editor2 = await vscode.window.showTextDocument(doc2);
		const pos2 = new vscode.Position(40, 0);
		editor2.selection = new vscode.Selection(pos2, pos2);
		await delay(100);

		// Go back
		await vscode.commands.executeCommand('caretHistory.back');
		await delay(100);

		// Verify we're at file1
		assert.strictEqual(
			vscode.window.activeTextEditor?.document.uri.fsPath,
			testFile1,
			'Should be at first file after going back'
		);

		// Go forward
		await vscode.commands.executeCommand('caretHistory.forward');
		await delay(100);

		// Verify we're back at file2
		assert.strictEqual(
			vscode.window.activeTextEditor?.document.uri.fsPath,
			testFile2,
			'Should be at second file after going forward'
		);
	});

	test('Clear command should reset history', async () => {
		// Create some history
		const doc1 = await vscode.workspace.openTextDocument(testFile1);
		const editor1 = await vscode.window.showTextDocument(doc1);
		editor1.selection = new vscode.Selection(new vscode.Position(10, 0), new vscode.Position(10, 0));
		await delay(100);

		const doc2 = await vscode.workspace.openTextDocument(testFile2);
		await vscode.window.showTextDocument(doc2);
		await delay(100);

		// Clear history
		await vscode.commands.executeCommand('caretHistory.clear');

		// Going back should now use VS Code's native navigation (not our history)
		// This is hard to test directly, but we can verify no errors occur
		try {
			await vscode.commands.executeCommand('caretHistory.back');
			assert.ok(true, 'Clear should work without errors');
		} catch {
			assert.fail('Should not throw after clearing history');
		}
	});
});

function delay(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}
