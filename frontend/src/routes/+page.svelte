<script>
	import { uploadAPI } from '$lib/api';

	let fileInput;
	let selectedFile = null;
	let uploading = false;
	let uploadResult = null;
	let tagInput = '';
	let selectedTags = [];
	let uploadToken = '';

	function handleFileSelect(event) {
		const file = event.target.files[0];
		if (file) {
			selectedFile = file;
		}
	}

	function normalizeTag(rawTag) {
		return rawTag.trim().toLowerCase();
	}

	function addTag(rawTag = tagInput) {
		const normalizedTag = normalizeTag(rawTag);
		if (!normalizedTag || selectedTags.includes(normalizedTag)) {
			tagInput = '';
			return;
		}
		selectedTags = [...selectedTags, normalizedTag];
		tagInput = '';
	}

	function removeTag(tagToRemove) {
		selectedTags = selectedTags.filter((tag) => tag !== tagToRemove);
	}

	function handleTagKeydown(event) {
		if (event.key === 'Enter' || event.key === ',') {
			event.preventDefault();
			addTag();
		}
	}

	async function handleUpload() {
		if (!selectedFile) {
			alert('Please select a file');
			return;
		}
		if (!uploadToken.trim()) {
			alert('Please enter upload token');
			return;
		}

		uploading = true;
		uploadResult = null;

		try {
			const response = await uploadAPI.uploadFile(selectedFile, selectedTags, uploadToken);
			uploadResult = {
				success: true,
				data: response.data
			};
			selectedFile = null;
			selectedTags = [];
			fileInput.value = '';
		} catch (error) {
			uploadResult = {
				success: false,
				error: error.response?.data?.error || error.message || 'Upload failed'
			};
		} finally {
			uploading = false;
		}
	}

</script>

<div class="page-container">
	<div class="card">
		<h2>Import Text File</h2>
		<p class="description">Upload a text file to extract words and automatically fetch their meanings and pronunciations.</p>

		<div class="upload-section">
			<input
				type="file"
				accept=".txt,.text,text/plain"
				bind:this={fileInput}
				on:change={handleFileSelect}
				disabled={uploading}
			/>
			{#if selectedFile}
				<p class="file-name">Selected: {selectedFile.name}</p>
			{/if}

			<div class="tag-input-section">
				<label for="upload-token">Upload Token:</label>
				<input
					id="upload-token"
					type="password"
					placeholder="Enter upload token"
					bind:value={uploadToken}
					disabled={uploading}
				/>

				<label for="tag-input">Tags (optional, multiple):</label>
				<div class="tag-input-row">
					<input
						id="tag-input"
						type="text"
						placeholder="e.g. grade-3, week-1"
						bind:value={tagInput}
						on:keydown={handleTagKeydown}
						disabled={uploading}
					/>
					<button class="btn-secondary" on:click={() => addTag()} disabled={uploading || !tagInput.trim()}>
						Add Tag
					</button>
				</div>
				{#if selectedTags.length > 0}
					<div class="tag-chips">
						{#each selectedTags as tag (tag)}
							<button class="tag-chip" on:click={() => removeTag(tag)} disabled={uploading}>
								{tag} ×
							</button>
						{/each}
					</div>
				{/if}
			</div>

			<button on:click={handleUpload} disabled={uploading || !selectedFile || !uploadToken.trim()}>
				{uploading ? 'Uploading...' : 'Upload & Process'}
			</button>
		</div>

		{#if uploadResult}
			<div class="result" class:success={uploadResult.success} class:error={!uploadResult.success}>
				{#if uploadResult.success}
					<h3>Upload Successful!</h3>
					<p>Processed {uploadResult.data.totalWords} words</p>
					<p>Successfully imported: {uploadResult.data.successCount}</p>
					{#if uploadResult.data.tags?.length > 0}
						<p>Tags: {uploadResult.data.tags.map((tag) => tag.name).join(', ')}</p>
					{/if}
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

	.btn-secondary {
		background: #4a5568;
	}

	.btn-secondary:hover:not(:disabled) {
		background: #2d3748;
	}

	.tag-input-section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.tag-input-section label {
		font-weight: 500;
		color: #4a5568;
	}

	.tag-input-row {
		display: flex;
		gap: 0.5rem;
	}

	.tag-input-row input {
		flex: 1;
		padding: 0.75rem;
		border: 1px solid #cbd5e0;
		border-radius: 8px;
	}

	.tag-input-section > input {
		padding: 0.75rem;
		border: 1px solid #cbd5e0;
		border-radius: 8px;
	}

	.tag-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.tag-chip {
		padding: 0.4rem 0.75rem;
		font-size: 0.85rem;
		background: #edf2f7;
		color: #2d3748;
	}

	.word-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.word-tag {
		display: inline-flex;
		align-items: center;
		padding: 0.2rem 0.6rem;
		border-radius: 999px;
		font-size: 0.75rem;
		font-weight: 600;
		background: #e6fffa;
		color: #234e52;
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

</style>
