const canvas = document.getElementById('overlay');
const ctx = canvas.getContext('2d');

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

window.addEventListener('resize', resize);
resize();

// WebSocket connection
const ws = new WebSocket(`ws://${window.location.host}/ws`);

ws.onopen = () => console.log('Connected to server');
ws.onclose = () => console.log('Disconnected from server');

ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.type === 'raid') {
        showRaid(message.data);
    }
    if (message.type === 'chat') {
        if (raidAnimation) {
            bossHp -= 1;
        }
    }
};

// Raid display
let raidAnimation = null;
let bossHp = 0;

function showRaid({ raiderName, viewerCount, profileImageUrl } = params) {
    if (raidAnimation) {
        setTimeout(() => showRaid(params), 2000);
        // cancelAnimationFrame(raidAnimation);
    } else {
        bossHp = viewerCount;
    }

    // Load profile image
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = profileImageUrl;

    const startTime = Date.now();
    const duration = Math.min(45000, Math.max(15000, viewerCount * 100)); // 8 seconds

    function animate() {
        const elapsed = Date.now() - startTime;
        const progress = elapsed / duration;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (progress >= 1) {
            raidAnimation = null;
            return;
        }

        // Fade in/out
        let alpha = 1;
        if (progress < 0.1) {
            alpha = progress / 0.1;
        } else if (progress > 0.8) {
            alpha = (1 - progress) / 0.2;
        }

        ctx.globalAlpha = alpha;

        // Draw centered raid notification
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;

        // Background box
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.roundRect(centerX - 250, centerY - 100, 500, 200, 20);
        ctx.fill();

        // Profile image (circular)
        if (img.complete && img.naturalWidth > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(centerX, centerY - 20, 50, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(img, centerX - 50, centerY - 70, 100, 100);
            ctx.restore();
        }

        // Text
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 28px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`${raiderName} draws near!!`, centerX, centerY + 50);

        if (bossHp > 0) {
            ctx.font = '22px Arial';
            ctx.fillText('Type in chat to attack!!', centerX, centerY + 85);
            ctx.fillText(`HP: ${bossHp}/${viewerCount}`, centerX + 85, centerY + 15);
        } else {
            ctx.font = '22px Arial';
            ctx.fillText('Boss defeated!! GG chat!', centerX, centerY + 85);
        }
        
        ctx.globalAlpha = 1;
        raidAnimation = requestAnimationFrame(animate);
    }

    animate();
}