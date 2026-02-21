<script>
	import { wordsAPI } from '$lib/api';
	import { onMount } from 'svelte';

	export let word = null;

	let flipped = false;
	let showingMeaning = false;
	let meaning = null;
	let loadingMeaning = false;

	function speak() {
		if (!word || !word.word) return;

		if ('speechSynthesis' in window) {
			const utterance = new SpeechSynthesisUtterance(word.word);
			utterance.lang = 'en-US';
			utterance.rate = 0.8;
			speechSynthesis.speak(utterance);
		} else {
			alert('Speech synthesis is not supported in your browser');
		}
	}

	function showAnswer() {
		flipped = true;
	}

	function hideAnswer() {
		flipped = false;
	}

	async function showMeaning() {
		if (showingMeaning && meaning) {
			showingMeaning = false;
			return;
		}

		if (word.meaning) {
			meaning = word.meaning;
			showingMeaning = true;
			return;
		}

		loadingMeaning = true;
		try {
			// Try to fetch meaning if not available
			const response = await wordsAPI.getById(word.id);
			if (response.data.meaning) {
				meaning = response.data.meaning;
				showingMeaning = true;
			} else {
				alert('Meaning not available for this word');
			}
		} catch (error) {
			console.error('Error fetching meaning:', error);
			alert('Could not fetch meaning');
		} finally {
			loadingMeaning = false;
		}
	}

	function reset() {
		flipped = false;
		showingMeaning = false;
		meaning = null;
	}

	// Reset when word changes
	$: if (word) {
		reset();
	}
</script>

{#if word}
	<div class="card-container">
		<div class="card" class:flipped={flipped}>
			<div class="card-front">
				<div class="card-content">
					<div class="word-hidden">
						<div class="hidden-indicator">?</div>
						<p class="hint">Click "Show Answer" to reveal the word</p>
					</div>
					<div class="card-actions">
						<button class="btn-speak" on:click={speak}>
							🔊 Speak
						</button>
						<button class="btn-show" on:click={showAnswer}>
							👁️ Show Answer
						</button>
					</div>
				</div>
			</div>
			<div class="card-back">
				<div class="card-content">
					<div class="word-revealed">
						<h2 class="word-text">{word.word}</h2>
						{#if word.pronunciation}
							<p class="pronunciation">/{word.pronunciation}/</p>
						{/if}
					</div>
					<div class="card-actions">
						<button class="btn-speak" on:click={speak}>
							🔊 Speak
						</button>
						<button class="btn-hide" on:click={hideAnswer}>
							🔙 Hide Answer
						</button>
						<button class="btn-meaning" on:click={showMeaning} disabled={loadingMeaning}>
							{loadingMeaning ? 'Loading...' : showingMeaning ? 'Hide Meaning' : '📖 Meaning'}
						</button>
					</div>
					{#if showingMeaning}
						<div class="meaning-section">
							<h3>Meaning:</h3>
							<p class="meaning-text">{meaning || 'Meaning not available'}</p>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
{:else}
	<div class="no-word">
		<p>No word available</p>
	</div>
{/if}

<style>
	.card-container {
		perspective: 1000px;
		width: 100%;
		max-width: 500px;
		margin: 0 auto;
	}

	.card {
		position: relative;
		width: 100%;
		height: 400px;
		transform-style: preserve-3d;
		transition: transform 0.6s;
	}

	.card.flipped {
		transform: rotateY(180deg);
	}

	.card-front,
	.card-back {
		position: absolute;
		width: 100%;
		height: 100%;
		backface-visibility: hidden;
		border-radius: 16px;
		box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
		background: white;
	}

	.card-back {
		transform: rotateY(180deg);
	}

	.card-content {
		padding: 2rem;
		height: 100%;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
	}

	.word-hidden {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		text-align: center;
	}

	.hidden-indicator {
		font-size: 5rem;
		color: #667eea;
		margin-bottom: 1rem;
	}

	.hint {
		color: #666;
		font-size: 1rem;
	}

	.word-revealed {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		text-align: center;
	}

	.word-text {
		font-size: 3rem;
		font-weight: 700;
		color: #333;
		margin: 0 0 1rem 0;
		word-break: break-word;
	}

	.pronunciation {
		font-size: 1.2rem;
		color: #667eea;
		font-style: italic;
		margin: 0;
	}

	.card-actions {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
		justify-content: center;
		margin-top: 1.5rem;
	}

	button {
		padding: 0.75rem 1.5rem;
		border: none;
		border-radius: 8px;
		font-size: 1rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
		flex: 1;
		min-width: 120px;
	}

	.btn-speak {
		background: #667eea;
		color: white;
	}

	.btn-speak:hover {
		background: #5568d3;
		transform: translateY(-2px);
	}

	.btn-show {
		background: #48bb78;
		color: white;
	}

	.btn-show:hover {
		background: #38a169;
		transform: translateY(-2px);
	}

	.btn-hide {
		background: #ed8936;
		color: white;
	}

	.btn-hide:hover {
		background: #dd6b20;
		transform: translateY(-2px);
	}

	.btn-meaning {
		background: #9f7aea;
		color: white;
	}

	.btn-meaning:hover:not(:disabled) {
		background: #805ad5;
		transform: translateY(-2px);
	}

	button:disabled {
		background: #ccc;
		cursor: not-allowed;
		transform: none;
	}

	.meaning-section {
		margin-top: 1.5rem;
		padding: 1rem;
		background: #f8f9ff;
		border-radius: 8px;
		border-left: 4px solid #9f7aea;
	}

	.meaning-section h3 {
		margin: 0 0 0.5rem 0;
		color: #333;
		font-size: 1rem;
	}

	.meaning-text {
		margin: 0;
		color: #666;
		line-height: 1.6;
	}

	.no-word {
		text-align: center;
		padding: 2rem;
		color: #666;
	}
</style>
