// آدرس Cloudflare Worker خودت را اینجا قرار بده
const WORKER_URL =
    "https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev";

const purchaseInput = document.getElementById("purchaseId");
const payButton = document.getElementById("payButton");
const message = document.getElementById("message");

payButton.addEventListener("click", async () => {

    const purchaseId = purchaseInput.value.trim();

    if (!purchaseId) {
        message.textContent = "شناسه خرید را وارد کنید.";
        return;
    }

    payButton.disabled = true;
    message.textContent = "در حال اتصال به درگاه...";

    try {

        const response = await fetch(
            `${WORKER_URL}/api/create-payment`,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    purchase_id: purchaseId
                })
            }
        );

        const result = await response.json();

        if (!response.ok || !result.ok) {
            throw new Error(
                result.error || "خطا در ایجاد پرداخت"
            );
        }

        // انتقال کاربر به زرین‌پال
        window.location.href = result.url;

    } catch (error) {

        message.textContent =
            error.message || "خطایی رخ داد.";

        payButton.disabled = false;
    }
});
