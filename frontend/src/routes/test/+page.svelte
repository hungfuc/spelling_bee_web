<script>
	import { wordsAPI } from '$lib/api';
	import WordCard from '$lib/components/WordCard.svelte';
	import { TTS_ENGINES, getTtsSettings, saveTtsSettings } from '$lib/ttsSettings';
	import { onMount } from 'svelte';

	let loading = false;
	let error = null;
	let notice = null;
	let tags = [];
	let testToken = '';
	let testAccessGranted = false;
	let tagFilterInput = '';
	let selectedTagIds = [];
	let suggestions = [];
	let questionCount = 10;
	let selectedWordCount = 0;
	let countLoading = false;

	let quizWords = [];
	let currentQuestionIndex = 0;
	let currentWord = null;
	let correctAnswers = 0;
	let questionAnswered = false;
	let testStarted = false;
	let testFinished = false;
	let ttsSettings = getTtsSettings();
	let ttsSavedNotice = '';
	let ttsLoaded = false;

	$: totalQuestions = quizWords.length;
	$: currentQuestionNumber = currentQuestionIndex + 1;
	$: scorePercent = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;

	onMount(() => {
		ttsSettings = getTtsSettings();
		ttsLoaded = true;
	});

	$: needsServiceUrl = ttsSettings.engine !== 'browser';
	$: needsCustomUrl = ttsSettings.engine === 'custom';
	$: requiresServiceUrl = ttsSettings.engine === 'kokoro' || ttsSettings.engine === 'coqui' || ttsSettings.engine === 'styletts2';
	$: if (ttsLoaded) {
		saveTtsSettings(ttsSettings);
		ttsSavedNotice = 'Auto-saved';
		setTimeout(() => {
			ttsSavedNotice = '';
		}, 900);
	}

	function parseTagNames(input) {
		return [...new Set(
			input
				.split(',')
				.map((name) => name.trim().toLowerCase())
				.filter(Boolean)
		)];
	}

	function getCurrentToken(input) {
		const parts = input.split(',');
		return (parts[parts.length - 1] || '').trim().toLowerCase();
	}

	function updateSuggestions() {
		const typedNames = new Set(parseTagNames(tagFilterInput));
		const currentToken = getCurrentToken(tagFilterInput);

		if (!currentToken) {
			suggestions = [];
			return;
		}

		suggestions = tags
			.map((tag) => tag.name.toLowerCase())
			.filter((name) => name.includes(currentToken) && !typedNames.has(name))
			.slice(0, 8);
	}

	function selectSuggestion(tagName) {
		const names = parseTagNames(tagFilterInput);
		const inputEndsWithComma = tagFilterInput.trim().endsWith(',');
		if (!inputEndsWithComma) {
			names.pop();
		}
		const merged = [...new Set([...names, tagName])];
		tagFilterInput = `${merged.join(', ')}${merged.length > 0 ? ', ' : ''}`;
		suggestions = [];
	}

	async function refreshSelectedWordCount() {
		if (!testAccessGranted) return;
		countLoading = true;
		try {
			const response = await wordsAPI.getAll(1, 1, selectedTagIds, testToken);
			selectedWordCount = response.data.total || 0;
		} catch (err) {
			selectedWordCount = 0;
		} finally {
			countLoading = false;
		}
	}

	async function applyTagFilter() {
		if (!testAccessGranted) return;

		const names = parseTagNames(tagFilterInput);
		if (names.length === 0) {
			selectedTagIds = [];
			error = null;
			await refreshSelectedWordCount();
			return;
		}

		const tagIdByName = new Map(tags.map((tag) => [tag.name.toLowerCase(), tag.id]));
		selectedTagIds = names
			.map((name) => tagIdByName.get(name))
			.filter((id) => Number.isInteger(id));

		if (selectedTagIds.length === 0) {
			error = 'No matching tags found';
			selectedWordCount = 0;
			return;
		}

		error = null;
		await refreshSelectedWordCount();
	}

	async function clearTagFilter() {
		if (!testAccessGranted) return;
		tagFilterInput = '';
		selectedTagIds = [];
		error = null;
		await refreshSelectedWordCount();
	}

	function handleFilterKeydown(event) {
		if (event.key === 'Enter') {
			event.preventDefault();
			void applyTagFilter();
		}
	}

	async function buildQuizWords(targetCount, tagIds) {
		const uniqueWords = new Map();
		const maxAttempts = targetCount * 20;

		for (let attempt = 0; attempt < maxAttempts && uniqueWords.size < targetCount; attempt += 1) {
			try {
				const response = await wordsAPI.getRandom(tagIds, testToken);
				const word = response.data;
				if (word && word.id && !uniqueWords.has(word.id)) {
					uniqueWords.set(word.id, word);
				}
			} catch (err) {
				if (err.response?.status === 404) {
					break;
				}
				throw err;
			}
		}

		return Array.from(uniqueWords.values());
	}

	async function startQuiz() {
		if (!testAccessGranted) return;

		await applyTagFilter();

		const desiredCount = Math.max(1, parseInt(questionCount, 10) || 1);
		loading = true;
		error = null;
		notice = null;

		try {
			const words = await buildQuizWords(desiredCount, selectedTagIds);

			if (words.length === 0) {
				error = 'No words available for the selected tags.';
				return;
			}

			if (words.length < desiredCount) {
				notice = `Only ${words.length} unique words are available. Test adjusted automatically.`;
			}

			quizWords = words;
			currentQuestionIndex = 0;
			currentWord = words[0];
			correctAnswers = 0;
			questionAnswered = false;
			testStarted = true;
			testFinished = false;
		} catch (err) {
			error = err.response?.data?.error || err.message || 'Failed to start test';
		} finally {
			loading = false;
		}
	}

	function handleAnswerSubmit(event) {
		if (!testStarted || questionAnswered) return;

		questionAnswered = true;
		if (event.detail?.isCorrect) {
			correctAnswers += 1;
		}
	}

	function nextQuestion() {
		if (!questionAnswered) return;

		if (currentQuestionIndex + 1 >= quizWords.length) {
			finishQuiz();
			return;
		}

		currentQuestionIndex += 1;
		currentWord = quizWords[currentQuestionIndex];
		questionAnswered = false;
	}

	function finishQuiz() {
		testStarted = false;
		testFinished = true;
		currentWord = null;
	}

	async function submitTestToken() {
		if (!testToken.trim()) {
			error = 'Please enter test token';
			return;
		}

		loading = true;
		error = null;
		notice = null;
		try {
			const response = await wordsAPI.getTags(testToken);
			tags = response.data.tags || [];
			testAccessGranted = true;
			quizWords = [];
			currentWord = null;
			testStarted = false;
			testFinished = false;
			tagFilterInput = '';
			selectedTagIds = [];
			selectedWordCount = 0;
			await refreshSelectedWordCount();
		} catch (err) {
			testAccessGranted = false;
			tags = [];
			error = err.response?.data?.error || 'Invalid test token';
		} finally {
			loading = false;
		}
	}

	$: updateSuggestions();
</script>

<div class="test-page">
	<div class="header">
		<h1>Spelling Bee Test</h1>
		<p class="tts-active">TTS: {ttsSettings.engine}</p>
		{#if testStarted}
			<p class="word-count">Question {currentQuestionNumber} / {totalQuestions} | Correct: {correctAnswers}</p>
		{/if}
	</div>

	<div class="filter-card">
		<p class="filter-title">TTS Engine Setup</p>
		<div class="setup-grid">
			<label>
				Engine
				<select bind:value={ttsSettings.engine}>
					{#each TTS_ENGINES as engine (engine.id)}
						<option value={engine.id}>{engine.label}</option>
					{/each}
				</select>
			</label>
			<label>
				Voice (optional)
				<input type="text" placeholder="voice name/id" bind:value={ttsSettings.voice} />
			</label>
			<label>
				Speed
				<input type="number" min="0.5" max="2" step="0.1" bind:value={ttsSettings.speed} />
			</label>
			{#if needsServiceUrl}
				<label>
					Service URL {requiresServiceUrl ? '(required)' : '(optional)'}
					<input type="url" placeholder="http://tts:8000 (Docker) or http://localhost:8000 (local backend)" bind:value={ttsSettings.serviceUrl} />
				</label>
			{/if}
			{#if needsCustomUrl}
				<label>
					Custom TTS URL (required for custom)
					<input type="url" placeholder="http://localhost:8010/tts" bind:value={ttsSettings.customUrl} />
				</label>
			{/if}
		</div>
		<div class="controls">
			{#if ttsSavedNotice}
				<span class="saved-inline">{ttsSavedNotice}</span>
			{/if}
		</div>
		{#if requiresServiceUrl && !ttsSettings.serviceUrl}
			<p class="filter-hint">Provide Service URL for this engine, for example `http://localhost:8010`.</p>
		{/if}
	</div>

	{#if !testAccessGranted}
		<div class="filter-card">
			<p class="filter-title">Enter Test Token</p>
			<p class="filter-hint">Token is configured in backend/config.json.</p>
			<div class="filter-controls">
				<input
					type="password"
					placeholder="Enter test token"
					bind:value={testToken}
					on:keydown={(event) => event.key === 'Enter' && submitTestToken()}
				/>
				<button on:click={submitTestToken} disabled={loading}>Enter Test</button>
			</div>
		</div>
	{/if}

	{#if testAccessGranted && !testStarted && !testFinished}
		<div class="filter-card">
			<p class="filter-title">Set Up Test</p>
			<div class="setup-grid">
				<label>
					Questions
					<input type="number" min="1" max="200" bind:value={questionCount} />
				</label>
			</div>
			<p class="filter-title">Filter by tags</p>
			<p class="filter-hint">Enter tags separated by commas. Leave empty to use all words.</p>
			<div class="filter-controls">
				<input
					type="text"
					placeholder="e.g. grade-3, week-1"
					bind:value={tagFilterInput}
					on:keydown={handleFilterKeydown}
				/>
				<button on:click={applyTagFilter}>Apply</button>
				<button class="btn-clear" on:click={clearTagFilter}>Clear</button>
			</div>
			<p class="filter-hint">
				{#if countLoading}
					Counting selected words...
				{:else}
					Selected words: {selectedWordCount}
				{/if}
			</p>
			{#if suggestions.length > 0}
				<div class="suggestions">
					{#each suggestions as suggestion (suggestion)}
						<button class="suggestion-chip" on:click={() => selectSuggestion(suggestion)}>
							{suggestion}
						</button>
					{/each}
				</div>
			{:else if tags.length === 0}
				<p class="filter-hint">No tags yet. Upload words with tags to get suggestions.</p>
			{/if}
			<div class="controls">
				<button class="btn-next" on:click={startQuiz} disabled={loading}>Start Test</button>
			</div>
		</div>
	{/if}

	{#if loading}
		<div class="loading">
			<p>Loading...</p>
		</div>
	{/if}

	{#if error}
		<div class="error">
			<p>{error}</p>
		</div>
	{/if}

	{#if notice}
		<div class="loading">
			<p>{notice}</p>
		</div>
	{/if}

	{#if testStarted && currentWord}
		<WordCard
			word={currentWord}
			testToken={testToken}
			quizMode={true}
			ttsSettings={ttsSettings}
			on:answerSubmit={handleAnswerSubmit}
		/>
		<div class="controls">
			<button class="btn-next" on:click={nextQuestion} disabled={!questionAnswered}>
				{currentQuestionIndex + 1 >= totalQuestions ? 'Finish Test' : 'Next Question'}
			</button>
		</div>
	{/if}

	{#if testFinished}
		<div class="filter-card">
			<p class="filter-title">Test Complete</p>
			<p class="filter-hint">Score: {correctAnswers} / {totalQuestions}</p>
			<p class="filter-hint">Correct Percentage: <strong>{scorePercent}%</strong></p>
			<div class="controls">
				<button class="btn-next" on:click={startQuiz}>Retake Test</button>
			</div>
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

	.tts-active {
		margin: 0 0 0.4rem;
		font-size: 0.95rem;
		opacity: 0.9;
	}

	.filter-card,
	.loading,
	.error,
	.no-word {
		background: white;
		padding: 1.25rem;
		border-radius: 12px;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
		text-align: left;
		width: min(700px, 90vw);
	}

	.filter-title {
		margin: 0 0 0.75rem 0;
		font-weight: 700;
		color: #2d3748;
	}

	.filter-hint {
		margin: 0 0 0.75rem 0;
		font-size: 0.9rem;
		color: #4a5568;
	}

	.setup-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 0.75rem;
		margin-bottom: 1rem;
	}

	.setup-grid label {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		color: #2d3748;
		font-weight: 600;
	}

	.setup-grid input {
		max-width: 100%;
		padding: 0.7rem;
		border: 1px solid #cbd5e0;
		border-radius: 8px;
	}

	.setup-grid select {
		max-width: 100%;
		padding: 0.7rem;
		border: 1px solid #cbd5e0;
		border-radius: 8px;
		background: #fff;
	}

	.filter-controls {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.filter-controls input {
		flex: 1;
		min-width: 260px;
		padding: 0.7rem;
		border: 1px solid #cbd5e0;
		border-radius: 8px;
	}

	.suggestions {
		margin-top: 0.75rem;
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.suggestion-chip {
		background: #edf2f7;
		color: #2d3748;
		border: 1px solid #cbd5e0;
		padding: 0.4rem 0.7rem;
		font-size: 0.9rem;
	}

	.suggestion-chip:hover {
		background: #e2e8f0;
	}

	.btn-clear {
		background: #4a5568;
	}

	.btn-clear:hover {
		background: #2d3748;
	}

	.error {
		background: #fff5f5;
		border: 2px solid #fc8181;
	}

	.error p {
		margin: 0;
		color: #c53030;
	}

	.controls {
		margin-top: 1rem;
	}

	.saved-inline {
		margin-left: 0.8rem;
		color: #2f855a;
		font-weight: 600;
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

	.btn-next:hover:not(:disabled) {
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

	button:hover:not(:disabled) {
		background: #5568d3;
	}

	button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
</style>
