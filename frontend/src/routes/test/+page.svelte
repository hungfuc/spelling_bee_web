<script>
	import { wordsAPI } from '$lib/api';
	import WordCard from '$lib/components/WordCard.svelte';
	import { onMount } from 'svelte';

	let currentWord = null;
	let loading = false;
	let error = null;
	let wordCount = 0;

	async function loadRandomWord() {
		loading = true;
		error = null;
		try {
			const response = await wordsAPI.getRandom();
			currentWord = response.data;
		} catch (err) {
			error = err.response?.data?.error || err.message || 'Failed to load word';
			console.error('Error loading word:', err);
		} finally {
			loading = false;
		}
	}

	async function loadWordCount() {
		try {
			const response = await wordsAPI.getAll(1, 1);
			wordCount = response.data.total || 0;
		} catch (err) {
			console.error('Error loading word count:', err);
		}
	}

	function handleNextWord() {
		loadRandomWord();
	}

	onMount(() => {
		loadRandomWord();
		loadWordCount();
	});
</script>

<div class="test-page">
	<div class="header">
		<h1>Spelling Bee Test</h1>
		{#if wordCount > 0}
			<p class="word-count">{wordCount} word{wordCount !== 1 ? 's' : ''} available</p>
		{/if}
	</div>

	{#if loading}
		<div class="loading">
			<p>Loading word...</p>
		</div>
	{:else if error}
		<div class="error">
			<p>{error}</p>
			{#if error.includes('No words')}
				<p class="hint">Go to the <a href="/">home page</a> to upload a text file first.</p>
			{:else}
				<button on:click={loadRandomWord}>Try Again</button>
			{/if}
		</div>
	{:else if currentWord}
		<WordCard word={currentWord} />
		<div class="controls">
			<button class="btn-next" on:click={handleNextWord}>
				➡️ Next Word
			</button>
		</div>
	{:else}
		<div class="no-word">
			<p>No word available</p>
			<button on:click={loadRandomWord}>Load Word</button>
		</div>
	{/if}
</div>

<style>
	.test-page {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2rem;
		min-height: 80vh;
		justify-content: center;
	}

	.header {
		text-align: center;
		color: white;
	}

	.header h1 {
		margin: 0 0 0.5rem 0;
		font-size: 2.5rem;
		text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
	}

	.word-count {
		margin: 0;
		font-size: 1.1rem;
		opacity: 0.9;
	}

	.loading,
	.error,
	.no-word {
		background: white;
		padding: 2rem;
		border-radius: 12px;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
		text-align: center;
	}

	.error {
		background: #fff5f5;
		border: 2px solid #fc8181;
	}

	.error p {
		margin: 0 0 1rem 0;
		color: #c53030;
	}

	.hint {
		color: #666;
		font-size: 0.9rem;
		margin-top: 1rem;
	}

	.hint a {
		color: #667eea;
		text-decoration: none;
		font-weight: 500;
	}

	.hint a:hover {
		text-decoration: underline;
	}

	.controls {
		margin-top: 2rem;
	}

	.btn-next {
		background: white;
		color: #667eea;
		border: 2px solid #667eea;
		padding: 1rem 2rem;
		border-radius: 8px;
		font-size: 1.1rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
	}

	.btn-next:hover {
		background: #667eea;
		color: white;
		transform: translateY(-2px);
		box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
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

	button:hover {
		background: #5568d3;
	}
</style>
