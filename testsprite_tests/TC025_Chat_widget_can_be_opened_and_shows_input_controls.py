import asyncio
from playwright import async_api
from playwright.async_api import expect

async def run_test():
    pw = None
    browser = None
    context = None

    try:
        # Start a Playwright session in asynchronous mode
        pw = await async_api.async_playwright().start()

        # Launch a Chromium browser in headless mode with custom arguments
        browser = await pw.chromium.launch(
            headless=True,
            args=[
                "--window-size=1280,720",         # Set the browser window size
                "--disable-dev-shm-usage",        # Avoid using /dev/shm which can cause issues in containers
                "--ipc=host",                     # Use host-level IPC for better stability
                "--single-process"                # Run the browser in a single process mode
            ],
        )

        # Create a new browser context (like an incognito window)
        context = await browser.new_context()
        context.set_default_timeout(5000)

        # Open a new page in the browser context
        page = await context.new_page()

        # Interact with the page elements to simulate user flow
        # -> Navigate to http://localhost:5000
        await page.goto("http://localhost:5000")
        
        # -> Navigate to /support (explicit navigate to http://localhost:5000/support as the test step requires).
        await page.goto("http://localhost:5000/support")
        
        # -> Click the likely chat iframe to try to open the chat launcher (click interactive iframe element at index 1906).
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/iframe').nth(0)
        await asyncio.sleep(3); await elem.click()
        
        # --> Assertions to verify final state
        frame = context.pages[-1]
        assert await frame.locator("xpath=//*[contains(., 'Chat widget')]").nth(0).is_visible(), "Expected 'Chat widget' to be visible"
        assert await frame.locator("xpath=//*[contains(., 'Message input')]").nth(0).is_visible(), "Expected 'Message input' to be visible"
        assert await frame.locator("xpath=//*[contains(., 'Send')]").nth(0).is_visible(), "Expected 'Send' to be visible"
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    