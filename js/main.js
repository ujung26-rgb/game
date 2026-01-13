/**
 * main.js
 * 포즈 인식과 게임 로직을 초기화하고 서로 연결하는 진입점
 */

// 전역 변수
let poseEngine;
let gameEngine;
let stabilizer;
let ctx;
let labelContainer;

/**
 * 애플리케이션 초기화
 */
async function init() {
  const startBtn = document.getElementById("startBtn");
  const stopBtn = document.getElementById("stopBtn");

  startBtn.disabled = true;

  try {
    // 1. PoseEngine 초기화
    poseEngine = new PoseEngine("./my_model/");
    const { maxPredictions, webcam } = await poseEngine.init({
      size: 200,
      flip: true
    });

    // 2. Stabilizer 초기화
    stabilizer = new PredictionStabilizer({
      threshold: 0.8, // 임계값 상향
      smoothingFrames: 5 // 부드러움 증가
    });

    // 3. GameEngine 초기화
    gameEngine = new GameEngine();
    setupGameCallbacks();

    // 4. 캔버스 설정
    const canvas = document.getElementById("canvas");
    canvas.width = 200;
    canvas.height = 200;
    ctx = canvas.getContext("2d");

    // 5. Label Container 설정
    labelContainer = document.getElementById("label-container");
    labelContainer.innerHTML = "";
    for (let i = 0; i < maxPredictions; i++) {
      labelContainer.appendChild(document.createElement("div"));
    }

    // 6. PoseEngine 콜백 설정
    poseEngine.setPredictionCallback(handlePrediction);
    poseEngine.setDrawCallback(drawPose);

    // 7. 엔진 시작
    poseEngine.start();
    gameEngine.start({ timeLimit: 60 });

    // 8. 키보드 입력 설정 (A, S, D)
    window.addEventListener("keydown", (event) => {
      const key = event.key.toLowerCase();
      if (key === "a") {
        gameEngine.onPoseDetected("Left");
      } else if (key === "s") {
        gameEngine.onPoseDetected("Center");
      } else if (key === "d") {
        gameEngine.onPoseDetected("Right");
      }
    });

    stopBtn.disabled = false;
  } catch (error) {
    console.error("초기화 중 오류 발생:", error);
    alert("초기화에 실패했습니다. 콘솔을 확인하세요.");
    startBtn.disabled = false;
  }
}

/**
 * 애플리케이션 중지
 */
function stop() {
  const startBtn = document.getElementById("startBtn");
  const stopBtn = document.getElementById("stopBtn");

  if (poseEngine) {
    poseEngine.stop();
  }

  if (gameEngine) {
    gameEngine.stop();
  }

  if (stabilizer) {
    stabilizer.reset();
  }

  startBtn.disabled = false;
  stopBtn.disabled = true;
}

/**
 * 게임 엔진 콜백 설정
 */
function setupGameCallbacks() {
  // 상태 업데이트 (렌더링)
  gameEngine.setGameStateUpdateCallback((state) => {
    renderGame(state);
  });

  // 점수 변경 (UI 업데이트)
  gameEngine.setScoreChangeCallback((score, level) => {
    document.getElementById("score").innerText = score;
    // 레벨 표시는 필요하다면 추가
  });

  // 게임 종료
  gameEngine.setGameEndCallback((finalScore, finalLevel) => {
    alert(`게임 종료! 최종 점수: ${finalScore}`);
    stop();
  });
}

/**
 * 게임 화면 렌더링
 */
function renderGame(state) {
  // 1. 시간 업데이트
  document.getElementById("time").innerText = state.timeLimit;
  document.getElementById("score").innerText = state.score;
  document.getElementById("level").innerText = state.level;

  // 2. 바구니 위치 업데이트
  const basket = document.getElementById("basket");
  const laneWidth = 120; // CSS에서 설정한 값 (360 / 3)
  const basketLeft = 10 + (state.basketPosition * laneWidth); // 10px margin
  basket.style.left = `${basketLeft}px`;

  // 3. 아이템 렌더링
  const itemLayer = document.getElementById("item-layer");
  itemLayer.innerHTML = ""; // 초기화 (성능 최적화 필요시 수정)

  state.items.forEach(item => {
    const el = document.createElement("div");
    el.className = "item";
    el.innerText = getItemEmoji(item.type);

    // 위치 설정 (레인 중앙)
    const itemLeft = 60 + (item.lane * laneWidth); // 60 = lane center
    el.style.left = `${itemLeft}px`;
    el.style.top = `${item.y}px`;

    itemLayer.appendChild(el);
  });
}

function getItemEmoji(type) {
  switch (type) {
    case "apple": return "🍎";
    case "orange": return "🍊";
    case "bomb": return "💣";
    default: return "❓";
  }
}

/**
 * 예측 결과 처리 콜백
 */
function handlePrediction(predictions, pose) {
  // 1. Stabilizer로 예측 안정화
  const stabilized = stabilizer.stabilize(predictions);

  // 2. 디버그 UI 업데이트
  if (labelContainer && labelContainer.childNodes.length > 0) {
    for (let i = 0; i < predictions.length; i++) {
      const classPrediction =
        predictions[i].className + ": " + predictions[i].probability.toFixed(2);
      if (labelContainer.childNodes[i]) {
        labelContainer.childNodes[i].innerHTML = classPrediction;
      }
    }
  }

  // 3. 최고 확률 예측 표시
  const maxPredictionDiv = document.getElementById("max-prediction");
  maxPredictionDiv.innerHTML = stabilized.className || "...";

  // 4. GameEngine에 포즈 전달 (키보드 모드로 전환되어 포즈 입력 비활성화)
  // if (gameEngine && gameEngine.isGameActive && stabilized.className) {
  //   gameEngine.onPoseDetected(stabilized.className);
  // }
}

/**
 * 포즈 그리기 콜백
 */
function drawPose(pose) {
  if (poseEngine.webcam && poseEngine.webcam.canvas) {
    ctx.drawImage(poseEngine.webcam.canvas, 0, 0);

    if (pose) {
      const minPartConfidence = 0.5;
      tmPose.drawKeypoints(pose.keypoints, minPartConfidence, ctx);
      tmPose.drawSkeleton(pose.keypoints, minPartConfidence, ctx);
    }
  }
}
