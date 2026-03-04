<script>
	import { createEventDispatcher } from 'svelte';
	import { wordsAPI } from '$lib/api';
	import { DEFAULT_TTS_SETTINGS } from '$lib/ttsSettings';

	export let word = null;
	export let testToken = '';
	export let quizMode = false;
	export let ttsSettings = DEFAULT_TTS_SETTINGS;

	let flipped = false;
	let showingMeaning = false;
	let meaning = null;
	let loadingMeaning = false;
	let speaking = false;
	let activeAudioUrl = null;
	let activeAudio = null;
	let activeUtterance = null;
	let answerInput = '';
	let answerResult = null;
	let answerSubmitted = false;
	const dispatch = createEventDispatcher();

	function normalizedTtsSettings() {
		const source = ttsSettings && typeof ttsSettings === 'object' ? ttsSettings : {};
		return {
			engine: String(source.engine || DEFAULT_TTS_SETTINGS.engine).toLowerCase(),
			voice: String(source.voice || '').trim(),
			speed: Number(source.speed) || 1,
			customUrl: String(source.customUrl || '').trim(),
			serviceUrl: String(source.serviceUrl || '').trim()
		};
	}

	function requiresDedicatedServiceUrl(engine) {
		return engine === 'kokoro' || engine === 'coqui' || engine === 'styletts2';
	}

	async function speakWithBrowser(text, options) {
		if (typeof window === 'undefined' || !window.speechSynthesis || typeof SpeechSynthesisUtterance === 'undefined') {
			throw new Error('Browser speech synthesis is not supported');
		}

		window.speechSynthesis.cancel();

		return new Promise((resolve, reject) => {
			const utterance = new SpeechSynthesisUtterance(text);
			utterance.rate = Math.min(2, Math.max(0.5, Number(options.speed) || 1));

			if (options.voice) {
				const selectedVoice = window.speechSynthesis
					.getVoices()
					.find((voice) => voice.name.toLowerCase() === options.voice.toLowerCase());
				if (selectedVoice) {
					utterance.voice = selectedVoice;
				}
			}

			activeUtterance = utterance;
			utterance.onend = () => {
				activeUtterance = null;
				resolve();
			};
			utterance.onerror = (event) => {
				activeUtterance = null;
				reject(new Error(event.error || 'speech_error'));
			};

			window.speechSynthesis.speak(utterance);
		});
	}

	async function speak() {
		if (!word || !word.word) return;

		if (speaking) {
			return;
		}

		const settings = normalizedTtsSettings();
		if (requiresDedicatedServiceUrl(settings.engine) && !settings.serviceUrl) {
			alert(`Set Service URL for ${settings.engine} in Test page TTS setup`);
			return;
		}
		if (settings.engine === 'custom' && !settings.customUrl) {
			alert('Set Custom TTS URL in Test page TTS setup');
			return;
		}
		if (settings.engine !== 'browser' && !testToken.trim()) {
			alert('Missing test token for speech');
			return;
		}

		speaking = true;
		try {
			if (activeAudio) {
				activeAudio.pause();
				activeAudio = null;
			}
			if (activeAudioUrl) {
				URL.revokeObjectURL(activeAudioUrl);
				activeAudioUrl = null;
			}
			if (activeUtterance && typeof window !== 'undefined' && window.speechSynthesis) {
				window.speechSynthesis.cancel();
				activeUtterance = null;
			}

			if (settings.engine === 'browser') {
				await speakWithBrowser(word.word, settings);
				speaking = false;
				return;
			}

			const response = await wordsAPI.textToSpeech(word.word, testToken, settings);
			const contentType = response.headers?.['content-type'] || 'audio/wav';
			const blob = new Blob([response.data], { type: contentType });
			activeAudioUrl = URL.createObjectURL(blob);
			activeAudio = new Audio(activeAudioUrl);
			activeAudio.onended = () => {
				speaking = false;
			};
			activeAudio.onerror = () => {
				speaking = false;
			};
			await activeAudio.play();
		} catch (error) {
			speaking = false;
			const backendError = error?.response?.data?.error;
			alert(backendError || 'Failed to play pronunciation audio');
		}
	}

	function showAnswer() {
		flipped = true;
	}

	function hideAnswer() {
		flipped = false;
	}

	function normalizeAnswer(value) {
		return String(value || '').trim().toLowerCase();
	}

	function submitAnswer() {
		if (!word || !word.word) return;
		if (answerSubmitted) return;

		const userAnswer = normalizeAnswer(answerInput);
		if (!userAnswer) {
			answerResult = null;
			return;
		}
		const correctWord = normalizeAnswer(word.word);
		answerResult = userAnswer === correctWord ? 'correct' : 'incorrect';
		answerSubmitted = true;
		dispatch('answerSubmit', {
			isCorrect: answerResult === 'correct',
			answer: answerInput,
			word: word.word
		});
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
		speaking = false;
		answerInput = '';
		answerResult = null;
		answerSubmitted = false;
		if (activeAudio) {
			activeAudio.pause();
			activeAudio = null;
		}
		if (activeAudioUrl) {
			URL.revokeObjectURL(activeAudioUrl);
			activeAudioUrl = null;
		}
		if (activeUtterance && typeof window !== 'undefined' && window.speechSynthesis) {
			window.speechSynthesis.cancel();
			activeUtterance = null;
		}
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
						<div class="answer-input-group">
							<input
								type="text"
								placeholder="Type your answer"
								bind:value={answerInput}
								disabled={answerSubmitted}
								on:keydown={(event) => event.key === 'Enter' && submitAnswer()}
							/>
							<button class="btn-submit" on:click={submitAnswer} disabled={answerSubmitted}>Submit</button>
						</div>
						{#if answerResult === 'correct'}
							<p class="answer-feedback correct">Correct</p>
						{:else if answerResult === 'incorrect'}
							<p class="answer-feedback incorrect">Incorrect</p>
						{/if}
					</div>
					<div class="card-actions">
						<button class="btn-speak" on:click={speak} disabled={speaking}>
							{speaking ? '🔊 Playing...' : '🔊 Speak'}
						</button>
						<button class="btn-show" on:click={showAnswer}>
							👁️ Show Answer
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
			<div class="card-back">
				<div class="card-content">
					<div class="word-revealed">
						<h2 class="word-text">{word.word}</h2>
						{#if word.pronunciation}
							<p class="pronunciation">/{word.pronunciation}/</p>
						{/if}
					</div>
					<div class="card-actions">
						<button class="btn-speak" on:click={speak} disabled={speaking}>
							{speaking ? '🔊 Playing...' : '🔊 Speak'}
						</button>
						<button class="btn-hide" on:click={hideAnswer}>
							🔙 Hide Answer
						</button>
						{#if !quizMode}
							<button class="btn-meaning" on:click={showMeaning} disabled={loadingMeaning}>
								{loadingMeaning ? 'Loading...' : showingMeaning ? 'Hide Meaning' : '📖 Meaning'}
							</button>
						{/if}
					</div>
					{#if showingMeaning && !quizMode}
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

	.answer-input-group {
		width: 100%;
		display: flex;
		gap: 0.5rem;
		margin-top: 1rem;
	}

	.answer-input-group input {
		flex: 1;
		padding: 0.75rem;
		border: 1px solid #ccc;
		border-radius: 8px;
		font-size: 1rem;
	}

	.answer-feedback {
		margin-top: 0.75rem;
		font-weight: 700;
	}

	.answer-feedback.correct {
		color: #2f855a;
	}

	.answer-feedback.incorrect {
		color: #c53030;
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

	.btn-submit {
		background: #2b6cb0;
		color: white;
		min-width: 100px;
		flex: 0;
	}

	.btn-submit:hover {
		background: #2c5282;
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
