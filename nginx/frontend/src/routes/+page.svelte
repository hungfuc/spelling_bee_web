<script>
	import { uploadAPI, wordsAPI } from '$lib/api';
	import { onMount } from 'svelte';

	let fileInput;
	let selectedFile = null;
	let uploading = false;
	let uploadResult = null;
	let words = [];
	let loading = false;
	let page = 1;
	let total = 0;

	function handleFileSelect(event) {
		const file = event.target.files[0];
		if (file) {
			selectedFile = file;
		}
	}

	async function handleUpload() {
		if (!selectedFile) {
			alert('Please select a file');
			return;
		}

		uploading = true;
		uploadResult = null;

		try {
			const response = await uploadAPI.uploadFile(selectedFile);
			uploadResult = {
				success: true,
				data: response.data
			};
			selectedFile = null;
			fileInput.value = '';
			// Refresh words list
			loadWords();
		} catch (error) {
			uploadResult = {
				success: false,
				error: error.response?.data?.error || error.message || 'Upload failed'
			};
		} finally {
			uploading = false;
		}
	}

	async function loadWords() {
		loading = true;
		try {
			const response = await wordsAPI.getAll(page);
			words = response.data.words;
			total = response.data.total;
		} catch (error) {
			console.error('Error loading words:', error);
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		loadWords();
	});
</script>

<div class="page-container">
	<div class="card">
		<h2>Import Text File</h2>
		<p class="description">Upload a text file to extract words and automatically fetch their meanings and pronunciations.</p>

		<div class="upload-section">
			<input
				type="file"
				accept=".txt,text/plain"
				bind:this={fileInput}
				on:change={handleFileSelect}
				disabled={uploading}
			/>
			{#if selectedFile}
				<p class="file-name">Selected: {selectedFile.name}</p>
			{/if}
			<button on:click={handleUpload} disabled={uploading || !selectedFile}>
				{uploading ? 'Uploading...' : 'Upload & Process'}
			</button>
		</div>

		{#if uploadResult}
			<div class="result" class:success={uploadResult.success} class:error={!uploadResult.success}>
				{#if uploadResult.success}
					<h3>Upload Successful!</h3>
					<p>Processed {uploadResult.data.totalWords} words</p>
					<p>Successfully imported: {uploadResult.data.successCount}</p>
					{#if uploadResult.data.errorCount > 0}
						<p>Errors: {uploadResult.data.errorCount}</p>
					{/if}
				{:else}
					<h3>Upload Failed</h3>
					<p>{uploadResult.error}</p>
				{/if}
			</div>
		{/if}
	</div>

	<div class="card">
		<h2>Imported Words ({total})</h2>
		{#if loading}
			<p>Loading words...</p>
		{:else if words.length === 0}
			<p>No words imported yet. Upload a text file to get started!</p>
		{:else}
			<div class="words-list">
				{#each words as word (word.id)}
					<div class="word-item">
						<span class="word-text">{word.word}</span>
						{#if word.pronunciation}
							<span class="pronunciation">/{word.pronunciation}/</span>
						{/if}
						{#if word.meaning}
							<span class="meaning">{word.meaning}</span>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

<style>
	.page-container {
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}

	.card {
		background: white;
		border-radius: 12px;
		padding: 2rem;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
	}

	.card h2 {
		margin-top: 0;
		color: #333;
	}

	.description {
		color: #666;
		margin-bottom: 1.5rem;
	}

	.upload-section {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.upload-section input[type="file"] {
		padding: 0.5rem;
		border: 2px dashed #667eea;
		border-radius: 8px;
		background: #f8f9ff;
		cursor: pointer;
	}

	.file-name {
		color: #667eea;
		font-weight: 500;
		margin: 0;
	}

	button {
		background: #667eea;
		color: white;
		border: none;
		padding: 0.75rem 1.5rem;
		border-radius: 8px;
		font-size: 1rem;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.2s;
	}

	button:hover:not(:disabled) {
		background: #5568d3;
	}

	button:disabled {
		background: #ccc;
		cursor: not-allowed;
	}

	.result {
		margin-top: 1.5rem;
		padding: 1rem;
		border-radius: 8px;
	}

	.result.success {
		background: #d4edda;
		border: 1px solid #c3e6cb;
		color: #155724;
	}

	.result.error {
		background: #f8d7da;
		border: 1px solid #f5c6cb;
		color: #721c24;
	}

	.result h3 {
		margin-top: 0;
	}

	.words-list {
		display: grid;
		gap: 1rem;
		max-height: 500px;
		overflow-y: auto;
	}

	.word-item {
		padding: 1rem;
		background: #f8f9ff;
		border-radius: 8px;
		border-left: 4px solid #667eea;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.word-text {
		font-weight: 600;
		font-size: 1.1rem;
		color: #333;
	}

	.pronunciation {
		color: #667eea;
		font-style: italic;
	}

	.meaning {
		color: #666;
		font-size: 0.9rem;
	}
</style>
