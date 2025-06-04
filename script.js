// script.js

const canvas = document.getElementById('catAnimationCanvas');
const ctx = canvas.getContext('2d');

let pawPrints = [];
const PAW_PRINT_DURATION = 3000;
const PAW_PRINT_SIZE = 5;
const PAW_PRINT_COLOR = 'rgba(200, 180, 220, 0.15)'; // More purple-ish white
let lastPawPrintTime = 0;
const PAW_PRINT_INTERVAL = 200; // Base interval, will be adjusted by speed
let stepToggle = true;

// Wind variables
let windParticles = [];
let isWindActive = false;
let windDirection = Math.PI; // Default: from right to left
let windStrength = 0; // 0 to 1 (or more for stronger wind)
const MAX_WIND_PARTICLES = 50;
let windChangeInterval = null;
const WIND_INTERVAL_MIN = 7000; // Minimum time between wind changes (ms)
const WIND_INTERVAL_MAX = 15000; // Maximum time
const WIND_DURATION_MIN = 3000;  // Minimum duration of a wind gust
const WIND_DURATION_MAX = 8000;  // Maximum duration

let idleTimeout = null;
const IDLE_DELAY = 3000; // 3 seconds to idle
let lastCursorUpdateTime = Date.now();

const cat = {
    x: 0, // Initialized in DOMContentLoaded
    y: 0,
    targetX: 0,
    targetY: 0,
    prevX: 0,
    prevY: 0,
    angle: -Math.PI / 2,

    bodyParts: {
        body: { width: 50, height: 70, color: '#6A5ACD' },
        head: { x: 0, y: -45, width: 35, height: 35, color: '#8A7090' },
        earLeft: { width: 12, height: 18, color: '#7F7FFF' },
        earRight: { width: 12, height: 18, color: '#7F7FFF' },
        tail: { width: 10, height: 45, color: '#8A7090' }
    },

    width: 0,
    height: 0,

    maxSpeed: 2.5,
    currentSpeed: 0,
    acceleration: 0.08,
    deceleration: 0.1,

    isIdle: false,
    idleState: '',
    idleStartTime: 0,
    circleAngle: 0,
    circleRadius: 120,
    circleCenterX: 0,
    circleCenterY: 0,

    isHunting: false,

    animationFrame: 0,
    tailAngle: 0,
    isBodyBobbing: false,
    bobOffset: 0,

    pawSize: 8,
};
// Initialize width/height after bodyParts definition
cat.width = cat.bodyParts.body.width;
cat.height = cat.bodyParts.body.height;


function resizeCanvas() {
    canvas.width = window.innerWidth * 0.8;
    canvas.height = window.innerHeight * 0.6;

    cat.x = Math.min(cat.x, canvas.width - cat.width / 2);
    cat.y = Math.min(cat.y, canvas.height - cat.height / 2);
    cat.targetX = Math.min(cat.targetX, canvas.width);
    cat.targetY = Math.min(cat.targetY, canvas.height);

    if (cat.isIdle && cat.idleState === 'circling') {
        cat.circleCenterX = Math.min(cat.circleCenterX, canvas.width - cat.circleRadius);
        cat.circleCenterX = Math.max(cat.circleCenterX, cat.circleRadius);
        cat.circleCenterY = Math.min(cat.circleCenterY, canvas.height - cat.circleRadius);
        cat.circleCenterY = Math.max(cat.circleCenterY, cat.circleRadius);
    }
}

function addPawPrint(catX, catY, catAngle) {
    const pawSideOffset = cat.bodyParts.body.width * (stepToggle ? -0.20 : 0.20);
    const pawForwardOffset = cat.bodyParts.body.height * 0.25;

    // Use cat's visual angle (angle + PI/2)
    const visualAngle = catAngle + Math.PI/2;
    const cosAngle = Math.cos(visualAngle);
    const sinAngle = Math.sin(visualAngle);

    const localPawX = pawSideOffset;
    const localPawY = pawForwardOffset;

    const printX = catX + (localPawX * cosAngle - localPawY * sinAngle);
    const printY = catY + (localPawX * sinAngle + localPawY * cosAngle);

    pawPrints.push({
        x: printX,
        y: printY,
        angle: catAngle, // Store the logical angle for rotation matching
        timestamp: Date.now(),
    });
    stepToggle = !stepToggle;
}

function drawPawPrints() {
    const now = Date.now();
    pawPrints = pawPrints.filter(p => (now - p.timestamp) < PAW_PRINT_DURATION);

    pawPrints.forEach(p => {
        const age = now - p.timestamp;
        const opacity = Math.max(0, 0.4 - (age / PAW_PRINT_DURATION) * 0.4);

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle + Math.PI / 2); // Match cat's visual rotation

        ctx.fillStyle = `rgba(200, 180, 220, ${opacity})`;
        ctx.beginPath();
        ctx.ellipse(0, 0, PAW_PRINT_SIZE, PAW_PRINT_SIZE * 1.2, 0, 0, 2 * Math.PI);
        ctx.fill();

        const toeRadius = PAW_PRINT_SIZE / 2.5;
        const toeOffsetY = PAW_PRINT_SIZE * 1.5;
        const toeSpreadX = PAW_PRINT_SIZE * 0.8;
        ctx.beginPath();
        ctx.arc(0, -toeOffsetY, toeRadius, 0, 2 * Math.PI);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(-toeSpreadX, -toeOffsetY * 0.85, toeRadius, 0, 2 * Math.PI);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(toeSpreadX, -toeOffsetY * 0.85, toeRadius, 0, 2 * Math.PI);
        ctx.fill();
        ctx.restore();
    });
}

function drawCat() {
    ctx.save();
    ctx.translate(cat.x, cat.y);
    ctx.rotate(cat.angle + Math.PI / 2);

    let currentYOffset = cat.isBodyBobbing ? cat.bobOffset : 0;
    ctx.translate(0, currentYOffset);

    // Tail reaction to wind
    let effectiveTailAngle = cat.tailAngle;
    if (isWindActive) {
        // Align tail more with wind direction, stronger wind = more alignment
        // This is a simplified model; true physics would be complex.
        // Angle difference between cat's facing direction and wind direction
        const angleToWind = windDirection - (cat.angle + Math.PI/2);
        // Apply some of this difference to the tail, scaled by wind strength
        effectiveTailAngle += angleToWind * windStrength * 0.5;
    }

    const tailBaseX = 0;
    const tailBaseY = cat.bodyParts.body.height / 2 - 5;
    const tailEndX = tailBaseX + (cat.bodyParts.tail.width * 1.8) * Math.cos(effectiveTailAngle);
    const tailEndY = tailBaseY + (cat.bodyParts.tail.height * 1.5) * Math.sin(effectiveTailAngle);
    const controlX1 = tailBaseX + (cat.bodyParts.tail.width * 0.8) * Math.cos(effectiveTailAngle - Math.PI / 4);
    const controlY1 = tailBaseY + (cat.bodyParts.tail.height * 0.8) * Math.sin(effectiveTailAngle - Math.PI / 4);
    const controlX2 = tailBaseX + (cat.bodyParts.tail.width * 2.0) * Math.cos(effectiveTailAngle + Math.PI/3);
    const controlY2 = tailBaseY + (cat.bodyParts.tail.height * 1.8) * Math.sin(effectiveTailAngle + Math.PI/3);

    ctx.beginPath();
    ctx.moveTo(tailBaseX, tailBaseY);
    ctx.bezierCurveTo(controlX1, controlY1, controlX2, controlY2, tailEndX, tailEndY);
    ctx.lineWidth = cat.bodyParts.tail.width / 1.2;
    ctx.strokeStyle = cat.bodyParts.tail.color;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Main Body
    ctx.fillStyle = cat.bodyParts.body.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, cat.bodyParts.body.width / 2, cat.bodyParts.body.height / 2, 0, 0, 2 * Math.PI);
    ctx.fill();

    // Head
    const headX = cat.bodyParts.head.x;
    const headY = cat.bodyParts.head.y;
    ctx.fillStyle = cat.bodyParts.head.color;
    ctx.beginPath();
    ctx.ellipse(headX, headY, cat.bodyParts.head.width / 2, cat.bodyParts.head.height / 2, 0, 0, 2 * Math.PI);
    ctx.fill();

    // Ears
    const earWidth = cat.bodyParts.earLeft.width;
    const earHeight = cat.bodyParts.earLeft.height;
    const headTopY = headY - cat.bodyParts.head.height / 2.2;
    ctx.fillStyle = cat.bodyParts.earLeft.color;
    ctx.beginPath();
    ctx.moveTo(headX - earWidth * 0.75, headTopY + earHeight * 0.1);
    ctx.lineTo(headX - earWidth * 0.25, headTopY + earHeight * 0.2);
    ctx.lineTo(headX - earWidth * 0.55, headTopY - earHeight * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = cat.bodyParts.earRight.color;
    ctx.beginPath();
    ctx.moveTo(headX + earWidth * 0.25, headTopY + earHeight * 0.2);
    ctx.lineTo(headX + earWidth * 0.75, headTopY + earHeight * 0.1);
    ctx.lineTo(headX + earWidth * 0.55, headTopY - earHeight * 0.7);
    ctx.closePath();
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#000000';
    const eyeRadius = cat.bodyParts.head.width / 9;
    const eyeDistFromCenter = cat.bodyParts.head.width / 4.5;
    const eyeVerticalPos = headY - cat.bodyParts.head.height / 10;

    let finalTargetX_eye = cat.targetX;
    let finalTargetY_eye = cat.targetY;
    if (cat.isIdle && cat.idleState === 'looking') {
        const lookDistance = 150;
        finalTargetX_eye = cat.x + lookDistance * Math.cos(cat.angle);
        finalTargetY_eye = cat.y + lookDistance * Math.sin(cat.angle);
    }

    // Calculate approximate global head position for more accurate gaze vector
    const visualCatAngle = cat.angle + Math.PI/2;
    const globalHeadX = cat.x + (headX * Math.cos(visualCatAngle) - (headY + currentYOffset) * Math.sin(visualCatAngle));
    const globalHeadY = cat.y + (headX * Math.sin(visualCatAngle) + (headY + currentYOffset) * Math.cos(visualCatAngle));

    const dxToTarget_world = finalTargetX_eye - globalHeadX;
    const dyToTarget_world = finalTargetY_eye - globalHeadY;
    const distToTarget = Math.sqrt(dxToTarget_world * dxToTarget_world + dyToTarget_world * dyToTarget_world);
    let eyeShiftX = 0;
    let eyeShiftY = 0;

    if (distToTarget > 1) {
        const cosA = Math.cos(-visualCatAngle); // Inverse rotation to get vector in local frame
        const sinA = Math.sin(-visualCatAngle);
        const localDx = dxToTarget_world * cosA - dyToTarget_world * sinA;
        const localDy = dxToTarget_world * sinA + dyToTarget_world * cosA;

        const maxShift = eyeRadius * 0.5;
        eyeShiftX = (localDx / distToTarget) * maxShift;
        eyeShiftY = (localDy / distToTarget) * maxShift;
    }

    ctx.beginPath();
    ctx.arc(headX - eyeDistFromCenter + eyeShiftX, eyeVerticalPos + eyeShiftY, eyeRadius, 0, 2 * Math.PI);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(headX + eyeDistFromCenter + eyeShiftX, eyeVerticalPos + eyeShiftY, eyeRadius, 0, 2 * Math.PI);
    ctx.fill();

    // Whiskers
    ctx.strokeStyle = '#4A4A4A';
    ctx.lineWidth = 0.8;
    const whiskerLength = cat.bodyParts.head.width / 2.2;
    const whiskerBaseXLeft = headX - cat.bodyParts.head.width / 3;
    const whiskerBaseXRight = headX + cat.bodyParts.head.width / 3;
    const whiskerY = headY + cat.bodyParts.head.height / 8;

    for (let i = 0; i < 3; i++) {
        let angleOffset = (Math.PI / 10) * (i - 1);
        let currentWhiskerLength = whiskerLength + (Math.random() - 0.5) * (whiskerLength * 0.1);

        // Whisker reaction to wind
        if (isWindActive) {
            // Calculate the component of wind perpendicular to the whisker's default angle
            // This is a simplification. Whiskers are complex.
            // Relative wind angle to cat's orientation
            const localWindAngle = windDirection - (cat.angle + Math.PI/2);

            // Apply a slight bend based on wind strength and direction relative to whisker
            // Left whiskers (negative X direction in local space)
            let windEffectLeft = Math.sin(localWindAngle + angleOffset) * windStrength * 0.3; // 0.3 is sensitivity
            // Right whiskers (positive X direction in local space)
            let windEffectRight = Math.sin(localWindAngle - angleOffset) * windStrength * 0.3;

            // Left
            ctx.beginPath();
            ctx.moveTo(whiskerBaseXLeft, whiskerY + i * 2.5);
            ctx.lineTo(whiskerBaseXLeft - currentWhiskerLength * Math.cos(angleOffset + windEffectLeft),
                       whiskerY + i * 2.5 - currentWhiskerLength * Math.sin(angleOffset + windEffectLeft));
            ctx.stroke();
            // Right
            ctx.beginPath();
            ctx.moveTo(whiskerBaseXRight, whiskerY + i * 2.5);
            ctx.lineTo(whiskerBaseXRight + currentWhiskerLength * Math.cos(angleOffset - windEffectRight),
                       whiskerY + i * 2.5 - currentWhiskerLength * Math.sin(angleOffset - windEffectRight));
            ctx.stroke();

        } else { // No wind, draw normally
            angleOffset += (Math.random() - 0.5) * 0.15; // Add small random flutter if no wind
             // Left
            ctx.beginPath();
            ctx.moveTo(whiskerBaseXLeft, whiskerY + i * 2.5);
            ctx.lineTo(whiskerBaseXLeft - currentWhiskerLength * Math.cos(angleOffset),
                       whiskerY + i * 2.5 - currentWhiskerLength * Math.sin(angleOffset));
            ctx.stroke();
            // Right
            ctx.beginPath();
            ctx.moveTo(whiskerBaseXRight, whiskerY + i * 2.5);
            ctx.lineTo(whiskerBaseXRight + currentWhiskerLength * Math.cos(angleOffset),
                       whiskerY + i * 2.5 - currentWhiskerLength * Math.sin(angleOffset));
            ctx.stroke();
        }
    }
    ctx.restore();
}

function updateWind() {
    if (isWindActive && windParticles.length < MAX_WIND_PARTICLES && Math.random() < windStrength * 0.7) {
        // Generate particle from edge of screen based on wind direction
        let x, y;
        const margin = 20; // Spawn slightly off-screen
        if (Math.cos(windDirection) > 0) { // Wind from left
            x = -margin;
            y = Math.random() * canvas.height;
        } else if (Math.cos(windDirection) < 0) { // Wind from right
            x = canvas.width + margin;
            y = Math.random() * canvas.height;
        } else { // Vertical wind
            y = Math.sin(windDirection) > 0 ? -margin : canvas.height + margin;
            x = Math.random() * canvas.width;
        }
        windParticles.push({
            x: x,
            y: y,
            size: Math.random() * 2 + 1,
            opacity: Math.random() * 0.3 + 0.1,
            speed: (Math.random() * 0.5 + 0.3) * windStrength * 5 // Scale with strength
        });
    }

    windParticles.forEach((p, index) => {
        p.x += Math.cos(windDirection) * p.speed;
        p.y += Math.sin(windDirection) * p.speed;
        p.opacity -= 0.002; // Fade out slowly

        if (p.opacity <= 0 || p.x < -30 || p.x > canvas.width + 30 || p.y < -30 || p.y > canvas.height + 30) {
            windParticles.splice(index, 1);
        }
    });
}

function drawWindParticles() {
    if (!isWindActive) return;
    windParticles.forEach(p => {
        ctx.fillStyle = `rgba(230, 230, 250, ${p.opacity})`; // Lavender white
        ctx.beginPath();
        // Draw streaks instead of circles for a more "windy" feel
        const len = p.size * 3 * windStrength; // Length depends on strength
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - Math.cos(windDirection) * len, p.y - Math.sin(windDirection) * len);
        ctx.lineWidth = p.size / 1.5;
        ctx.strokeStyle = `rgba(230, 230, 250, ${p.opacity})`;
        ctx.stroke();
    });
}


function manageWindCycle() {
    function triggerWind() {
        isWindActive = true;
        windStrength = Math.random() * 0.4 + 0.2; // Random strength (0.2 to 0.6)
        windDirection = Math.random() * Math.PI * 2; // Random direction

        const currentWindDuration = Math.random() * (WIND_DURATION_MAX - WIND_DURATION_MIN) + WIND_DURATION_MIN;

        setTimeout(() => {
            isWindActive = false;
            // Particles will naturally fade or leave screen. Strength goes to 0 gradually.
            let fadeOutInterval = setInterval(() => {
                windStrength -= 0.02;
                if (windStrength <= 0) {
                    windStrength = 0;
                    clearInterval(fadeOutInterval);
                }
            }, 50);

            // Schedule next wind gust
            const nextGustDelay = Math.random() * (WIND_INTERVAL_MAX - WIND_INTERVAL_MIN) + WIND_INTERVAL_MIN;
            if (windChangeInterval) clearTimeout(windChangeInterval); // Clear existing before setting new
            windChangeInterval = setTimeout(triggerWind, nextGustDelay);

        }, currentWindDuration);
    }
    // Initial call to start the cycle
    const initialDelay = Math.random() * (WIND_INTERVAL_MAX - WIND_INTERVAL_MIN) + WIND_INTERVAL_MIN;
    windChangeInterval = setTimeout(triggerWind, initialDelay);
}


function updateCatPosition() {
    cat.prevX = cat.x;
    cat.prevY = cat.y;
    cat.animationFrame++;

    // Base tail animation
    let baseTailAngle = Math.sin(cat.animationFrame * 0.06) * 0.7;
    cat.tailAngle = baseTailAngle; // Will be modified by wind in drawCat

    let dx, dy, distance;

    if (!cat.isIdle) {
        dx = cat.targetX - cat.x;
        dy = cat.targetY - cat.y;
        distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 0.1) cat.angle = Math.atan2(dy, dx);

        if (distance > 1) {
            if (cat.currentSpeed < cat.maxSpeed) cat.currentSpeed += cat.acceleration;
            else cat.currentSpeed = cat.maxSpeed;
        } else {
            if (cat.currentSpeed > cat.deceleration) cat.currentSpeed -= cat.deceleration;
            else cat.currentSpeed = 0;
        }
        cat.currentSpeed = Math.max(0, cat.currentSpeed);

        if (cat.currentSpeed > 0 && distance > 0.1) {
            cat.x += (dx / distance) * cat.currentSpeed;
            cat.y += (dy / distance) * cat.currentSpeed;
        } else if (distance <= 0.1 && cat.currentSpeed < cat.deceleration) {
            cat.x = cat.targetX;
            cat.y = cat.targetY;
            cat.currentSpeed = 0;
        }
        cat.isHunting = distance < cat.bodyParts.body.width * 1.8;

    } else {
        cat.isHunting = false;
        const timeInIdleState = Date.now() - cat.idleStartTime;

        if (cat.idleState === 'looking') {
            cat.currentSpeed = Math.max(0, cat.currentSpeed - cat.deceleration);
            const lookDuration = 3500;

            let targetLookAngle = Math.sin(timeInIdleState / 1200) * (Math.PI / 2.5);
            targetLookAngle += cat.angle; // Make it relative to current facing for smoother pan from any orientation

            let currentAngleNorm = (cat.angle % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
            let targetAngleNorm = (targetLookAngle % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);

            let angleDiff = targetAngleNorm - currentAngleNorm;
            if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
            if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

            cat.angle += angleDiff * 0.03;

            if (timeInIdleState > lookDuration) {
                cat.idleState = 'circling';
                cat.idleStartTime = Date.now();
                cat.circleCenterX = cat.x;
                cat.circleCenterY = cat.y;
                cat.circleAngle = cat.angle;
            }
        } else if (cat.idleState === 'circling') {
            cat.circleAngle += 0.012;

            let targetCircX = cat.circleCenterX + cat.circleRadius * Math.cos(cat.circleAngle);
            let targetCircY = cat.circleCenterY + cat.circleRadius * Math.sin(cat.circleAngle);

            targetCircX = Math.max(cat.bodyParts.body.width / 2, Math.min(targetCircX, canvas.width - cat.bodyParts.body.width / 2));
            targetCircY = Math.max(cat.bodyParts.body.height / 2, Math.min(targetCircY, canvas.height - cat.bodyParts.body.height / 2));

            dx = targetCircX - cat.x;
            dy = targetCircY - cat.y;
            distance = Math.sqrt(dx * dx + dy * dy);

            if (distance > 0.1) cat.angle = Math.atan2(dy, dx);

            const circlingSpeed = cat.maxSpeed * 0.4;
            if (cat.currentSpeed < circlingSpeed - cat.acceleration) cat.currentSpeed += cat.acceleration;
            else if (cat.currentSpeed > circlingSpeed + cat.deceleration) cat.currentSpeed -= cat.deceleration;
            else cat.currentSpeed = circlingSpeed;
            cat.currentSpeed = Math.max(0, cat.currentSpeed);

            if (distance > cat.currentSpeed) {
                cat.x += (dx / distance) * cat.currentSpeed;
                cat.y += (dy / distance) * cat.currentSpeed;
            } else if (distance > 0.1) {
                 cat.x += dx * 0.5;
                 cat.y += dy * 0.5;
            }
        }
    }

    const movedDistance = Math.sqrt(Math.pow(cat.x - cat.prevX, 2) + Math.pow(cat.y - cat.prevY, 2));
    if (movedDistance > 0.05 && cat.currentSpeed > 0.05) {
        cat.isBodyBobbing = true;
        cat.bobOffset = Math.sin(cat.animationFrame * 0.15 * cat.currentSpeed) * (cat.currentSpeed * 0.6 + 0.5);
    } else {
        cat.isBodyBobbing = false;
        cat.bobOffset = 0;
    }

    const pawPrintDynamicInterval = PAW_PRINT_INTERVAL / (cat.currentSpeed * 0.5 + 1); // Slower speed = larger interval number = less frequent
    if (movedDistance > 0.5 && cat.currentSpeed > 0.2 && (Date.now() - lastPawPrintTime > pawPrintDynamicInterval )) {
        addPawPrint(cat.x, cat.y, cat.angle);
        lastPawPrintTime = Date.now();
    }
}

function gameLoop() {
    updateCatPosition();
    updateWind(); // Update wind particle positions and generate new ones
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawPawPrints();
    drawWindParticles(); // Draw wind before the cat
    drawCat();
    requestAnimationFrame(gameLoop);
}

window.addEventListener('resize', resizeCanvas);

document.addEventListener('DOMContentLoaded', () => {
    // Initialize cat properties that depend on canvas size first
    cat.x = canvas.width / 2;
    cat.y = canvas.height / 2;
    cat.targetX = cat.x;
    cat.targetY = cat.y;
    cat.prevX = cat.x;
    cat.prevY = cat.y;
    cat.circleCenterX = cat.x;
    cat.circleCenterY = cat.y;
    cat.angle = -Math.PI / 2; // Initial angle - facing upwards

    resizeCanvas(); // Call resize once to set initial canvas and responsive cat properties
    manageWindCycle(); // Start the wind cycle

    lastCursorUpdateTime = Date.now();
    idleTimeout = setTimeout(() => {
        if (Date.now() - lastCursorUpdateTime >= IDLE_DELAY) {
            cat.isIdle = true;
            cat.idleState = 'looking';
            cat.idleStartTime = Date.now();
        }
    }, IDLE_DELAY);

    canvas.addEventListener('mousemove', (event) => {
        const rect = canvas.getBoundingClientRect();
        cat.targetX = event.clientX - rect.left;
        cat.targetY = event.clientY - rect.top;

        if (cat.isIdle) {
             cat.currentSpeed = Math.min(cat.currentSpeed + cat.acceleration * 5, cat.maxSpeed);
        }
        cat.isIdle = false;
        cat.idleState = '';
        lastCursorUpdateTime = Date.now();

        if (idleTimeout) clearTimeout(idleTimeout);
        idleTimeout = setTimeout(() => {
            if (Date.now() - lastCursorUpdateTime >= IDLE_DELAY) {
                cat.isIdle = true;
                cat.idleState = 'looking';
                cat.idleStartTime = Date.now();
            }
        }, IDLE_DELAY);
    });

    lastPawPrintTime = Date.now();
    gameLoop();
});

console.log('Script loaded. Cat details enhanced, animation refined, wind effect added.');
