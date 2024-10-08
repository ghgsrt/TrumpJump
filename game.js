const clamp = (min, max) => (toClamp) => Math.max(Math.min(max, toClamp), min);
const random = (min, max) => Math.random() * (max - min) + min;

let inMenu = true;

const ROOT = document.getElementById('root');
const SPACE = document.getElementById('space');
const PLAY = document.getElementById('play');
const MENU = document.getElementById('menu');

let trumps = [document.getElementById('trump')];

PLAY.onclick = () => {
	PLAY.blur();
	startGame();
};

const trumpObserver = new IntersectionObserver(
	(entries) => {
		if (!entries[0].isIntersecting) {
			if (trumps[1].offsetLeft < bounds.left) {
				trumpObserver.unobserve(trumps[1]);
				trumps = [trumps[1], trumps[2], trumps[0]];
				pos[0] += bounds.width;
				trumpObserver.observe(trumps[1]);
			} else if (trumps[1].offsetLeft > bounds.width) {
				trumpObserver.unobserve(trumps[1]);
				trumps = [trumps[2], trumps[0], trumps[1]];
				pos[0] -= bounds.width;
				trumpObserver.observe(trumps[1]);
			}
		}
	},
	{
		root: SPACE,
		threshold: 0,
		rootMargin: '100% 0px 100% 0px',
	}
);

const bounds = SPACE.getBoundingClientRect();

const platformInfo = [];
const platformObserver = new IntersectionObserver(
	(entries) => {
		for (const entry of entries) {
			if (!platformInfo.find((info) => info[0] === entry.target)) {
				if (entry.isIntersecting) {
					platformInfo.push([
						entry.target,
						[
							parseInt(entry.target.style.left),
							parseInt(entry.target.style.bottom),
						],
					]);
				}
			} else if (!entry.isIntersecting) {
				platformInfo.splice(
					platformInfo.findIndex((info) => info[0] === entry.target),
					1
				);
			}
		}
	},
	{
		root: null,
		threshold: 0,
	}
);

const platforms = document.querySelectorAll('.platform');

const platformDims = [
	platforms[0]?.clientWidth ?? 0,
	platforms[0]?.clientHeight ?? 0,
];
const platformBounds = {
	left: 0,
	right: bounds.width - platformDims[0] ?? 0,
	bottom: 0,
	top: bounds.height - platformDims[1] ?? 0,
};

const platformBoundX = clamp(platformBounds.left, platformBounds.right);
const platformBoundY = clamp(platformBounds.bottom, platformBounds.top);

for (const platform of platforms) {
	platform.style.left =
		platformBoundX(random(platformBounds.left, platformBounds.right)) + 'px';
	platform.style.bottom =
		platformBoundY(random(platformBounds.bottom, platformBounds.top)) + 'px';

	platformObserver.observe(platform);
}

function aabbTest(min1, max1, min2, max2) {
	return (
		max1[0] > min2[0] &&
		min1[0] < max2[0] &&
		max1[1] > min2[1] &&
		min1[1] < max2[1]
	);
}

function detectCollisionOrPassthrough(
	prevPos,
	newPos,
	boxSize,
	rectPos,
	rectSize
) {
	const movementMin = [
		Math.min(prevPos[0], newPos[0]),
		Math.min(prevPos[1], newPos[1]),
	];
	const movementMax = [
		Math.max(prevPos[0] + boxSize[0], newPos[0] + boxSize[0]),
		Math.max(prevPos[1] + boxSize[1], newPos[1] + boxSize[1]),
	];

	const rectMin = rectPos;
	const rectMax = [rectPos[0] + rectSize[0], rectPos[1] + rectSize[1]];

	if (aabbTest(movementMin, movementMax, rectMin, rectMax)) {
		return true;
	}

	return false;
}

function detectBottomCollisionOrPassthrough(
	prevPos,
	newPos,
	boxSize,
	rectPos,
	rectSize
) {
	const rectTop = rectPos[1] + rectSize[1];

	if (newPos[1] >= rectTop || prevPos[1] < rectTop) {
		return false;
	}
	const boxLeftX = Math.min(prevPos[0], newPos[0]);
	const boxRightX = Math.max(prevPos[0] + boxSize[0], newPos[0] + boxSize[0]);
	const rectLeftX = rectPos[0];
	const rectRightX = rectPos[0] + rectSize[0];

	if (boxRightX <= rectLeftX || boxLeftX >= rectRightX) {
		return false;
	}

	return (
		newPos[1] < rectTop &&
		newPos[0] < rectRightX &&
		newPos[0] + boxSize[0] > rectLeftX
	);
}

const trumpDims = [trumps[0].clientWidth, trumps[0].clientHeight];

let isOnGround = true;

const GRAVITY = -0.07;
const BASE_MOVE_ACCEL = 0.2;
const BASE_JUMP_HEIGHT = 5.5;
const MAX_VELOCITY_X = 5;
const MAX_VELOCITY_Y = 15;

const pos = [bounds.width / 2 - trumpDims[0] / 2, 0];
const velocity = [0, 0];
const acceleration = [0, GRAVITY];

const tryMoveX = (x) => x; //clamp(0, bounds.width - trumpDims[0]);
let tryMoveY = clamp(0, bounds.bottom - trumpDims[1]);

const tryAccelX = clamp(-MAX_VELOCITY_X, MAX_VELOCITY_X);
const tryAccelY = clamp(-MAX_VELOCITY_Y, MAX_VELOCITY_Y);

function updatePos(idx, offset, prevPos) {
	offset ??= 0;
	prevPos ??= [pos[0] - offset, pos[1]];
	if (idx === 1) {
		pos[0] = tryMoveX(pos[0] + velocity[0]);
		pos[1] = tryMoveY(pos[1] + velocity[1]);
	}
	trumps[idx].style.left = pos[0] - offset + 'px';
	trumps[idx].style.bottom = pos[1] + 'px';

	if (velocity[1] < 0)
		for (let i = 0; i < platformInfo.length; i++) {
			const [platform, platformPos] = platformInfo[i];
			const collision = detectBottomCollisionOrPassthrough(
				prevPos,
				[pos[0] - offset, pos[1]],
				trumpDims,
				platformPos,
				platformDims
			);
			if (collision) {
				jump(true);
				if (!inMenu) {
					platformObserver.unobserve(platform);
					platformInfo.splice(i, 1);
					platform.classList.add('broken');
					// setTimeout(platform.remove, 500);
				}
				break;
			}
		}

	if (idx === 1) {
		if (pos[1] === bounds.bottom - trumpDims[1]) {
			velocity[1] = 0;
		}

		if (!inMenu) {
			const rect = trumps[idx].getBoundingClientRect();
			const t = rect.top + trumpDims[1] / 2;
			const d = document.documentElement.clientHeight / 2;

			if (velocity[1] > 0 && t < d) {
				setTimeout(() => {
					// window.scrollTo(0, document.body.scrollTop - (d - t));
					// window.scrollTo(0, ROOT.scrollTop - (d - t));
					// window.scrollTo({
					// 	top: document.documentElement.scrollTop - (d - t),
					// 	behavior: 'smooth',
					// });
					window.scrollTo(0, document.documentElement.scrollTop - (d - t), {
						behavior: 'smooth',
					});
				});
			} else if (rect.top > document.documentElement.clientHeight) gameOver();
		}
		if (pos[1] === 0) isOnGround = true;

		if (acceleration[0] === 0 && velocity[0] !== 0) {
			const sign = Math.sign(velocity[0]);
			velocity[0] -= sign * BASE_MOVE_ACCEL;
			if (Math.sign(velocity[0]) !== sign) velocity[0] = 0;
		} else velocity[0] = tryAccelX(velocity[0] + acceleration[0]);
		if (isOnGround) velocity[1] = 0;
		else velocity[1] = tryAccelY(velocity[1] + acceleration[1]);
	}

	return prevPos;
}

function jump(force = false) {
	if (force || isOnGround) {
		oofSounds[Math.round(random(0, oofSounds.length - 1))].play();
		isOnGround = false;
		velocity[1] = BASE_JUMP_HEIGHT;
	}
}
const moveLeft = () => (acceleration[0] = -BASE_MOVE_ACCEL);
const moveRight = () => (acceleration[0] = BASE_MOVE_ACCEL);
const stopMoving = () => (acceleration[0] = 0);
const inputActions = {
	a: moveLeft,
	d: moveRight,
};
const inputStack = [];

const mobileLeft = document.getElementById('mobile-left');
const mobileRight = document.getElementById('mobile-right');

const ignore = (e) => {
	e.preventDefault();
	e.stopPropagation();
};
mobileLeft.addEventListener('touchstart', ignore);
mobileLeft.addEventListener('touchend', ignore);
mobileLeft.addEventListener('touchmove', ignore);
mobileLeft.addEventListener('touchcancel', ignore);

mobileRight.addEventListener('touchstart', ignore);
mobileRight.addEventListener('touchend', ignore);
mobileRight.addEventListener('touchmove', ignore);
mobileRight.addEventListener('touchcancel', ignore);

mobileLeft.addEventListener('pointerdown', (e) => {
	e.preventDefault();
	e.stopPropagation();

	if (inputStack.includes('a')) return;

	jump();

	inputStack.push('a');
	inputActions['a']();
});
mobileLeft.addEventListener('pointerup', (e) => {
	e.preventDefault();
	e.stopPropagation();

	inputStack.splice(inputStack.indexOf('a'), 1);
	if (inputStack.length > 0) inputActions[inputStack[inputStack.length - 1]]();
	else stopMoving();
});
mobileRight.addEventListener('pointerdown', (e) => {
	e.preventDefault();
	e.stopPropagation();

	if (inputStack.includes('d')) return;

	jump();

	inputStack.push('d');
	inputActions['d']();
});
mobileRight.addEventListener('pointerup', (e) => {
	e.preventDefault();
	e.stopPropagation();

	inputStack.splice(inputStack.indexOf('d'), 1);
	if (inputStack.length > 0) inputActions[inputStack[inputStack.length - 1]]();
	else stopMoving();
});

window.addEventListener('keydown', (e) => {
	if (inputStack.includes(e.key)) return;

	switch (e.key) {
		case 'a':
		case 'd':
			inputStack.push(e.key);
			inputActions[e.key]();
			break;
		case ' ':
			jump();
			break;
	}
});
window.addEventListener('keyup', (e) => {
	switch (e.key) {
		case 'a':
		case 'd':
			inputStack.splice(inputStack.indexOf(e.key), 1);
			if (inputStack.length > 0)
				inputActions[inputStack[inputStack.length - 1]]();
			else stopMoving();
	}
});

function render() {
	const _render = () => {
		let prevPos = updatePos(1);
		updatePos(0, bounds.width, prevPos);
		updatePos(2, -bounds.width, prevPos);

		requestAnimationFrame(_render);
	};

	requestAnimationFrame(_render);
}

let bgMusic;
let eatingDogs;
const oofSounds = [];

window.addEventListener('load', () => {
	const newTrump = trumps[0].cloneNode(true);
	SPACE.appendChild(newTrump);
	trumps.push(newTrump);
	const newTrump2 = trumps[0].cloneNode(true);
	SPACE.appendChild(newTrump2);
	trumps.push(newTrump2);

	trumpObserver.observe(trumps[1]);

	setTimeout(() => {
		// window.scrollTo({
		// 	top: document.body.scrollHeight,
		// 	behavior: 'smooth',
		// });
		window.scrollTo(0, document.body.scrollHeight);
		// window.scrollTo(0, document.documentElement.scrollHeight);
		// window.scrollTo(0, ROOT.scrollHeight);
	});

	bgMusic = new Audio('hail_to_the_chief.mp3');
	eatingDogs = new Audio('eating-dogs-short.mp3');
	oofSounds.push(
		new Audio('aeah-audio.mp3'),
		new Audio('ahh-converted.mp3'),
		new Audio('eaaah-converted.mp3'),
		new Audio('ouh-converted.mp3')
	);
	bgMusic.loop = true;

	render();
});

function resetGame() {
	for (const platform of platforms) {
		platformObserver.observe(platform);
		platform.classList.remove('broken');
	}
}

function startGame() {
	eatingDogs.play();
	bgMusic.play();

	tryMoveY = clamp(0, bounds.height - trumpDims[1]);
	inMenu = false;
	MENU.classList.remove('active');
}

function gameOver() {
	resetGame();

	bgMusic.pause();
	bgMusic.currentTime = 0;

	tryMoveY = clamp(0, bounds.bottom - trumpDims[1]);
	inMenu = true;
	MENU.classList.add('active');
	// window.scrollTo({
	// 	top: document.body.scrollHeight,
	// 	behavior: 'smooth',
	// });
	window.scrollTo(0, document.body.scrollHeight);
}

const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
function disableIOSTextFieldZoom() {
	if (!IS_IOS) return;

	const element = document.querySelector('meta[name=viewport]');
	let content = element.getAttribute('content');

	element.setAttribute(
		'content',
		content + ', maximum-scale=1.0, user-scalable=no'
	);
}
disableIOSTextFieldZoom();
