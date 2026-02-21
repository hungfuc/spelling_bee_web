<script>
	import '../app.css';
</script>

<nav>
	<div class="container">
		<h1>Spelling Bee</h1>
		<div class="nav-links">
			<a href="/">Home</a>
			<a href="/test">Test</a>
		</div>
	</div>
</nav>

<main>
	<slot />
</main>

<style>
	:global(body) {
		margin: 0;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		min-height: 100vh;
	}

	nav {
		background: rgba(255, 255, 255, 0.95);
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
		padding: 1rem 0;
	}

	nav .container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 0 2rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	nav h1 {
		margin: 0;
		color: #667eea;
		font-size: 1.5rem;
	}

	nav .nav-links {
		display: flex;
		gap: 2rem;
	}

	nav .nav-links a {
		color: #333;
		text-decoration: none;
		font-weight: 500;
		transition: color 0.2s;
	}

	nav .nav-links a:hover {
		color: #667eea;
	}

	main {
		max-width: 1200px;
		margin: 2rem auto;
		padding: 0 2rem;
	}
</style>
