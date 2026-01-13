/**
 * gameEngine.js
 * "Fruit Catcher" 게임 로직 구현
 */

class GameEngine {
  constructor() {
    this.score = 0;
    this.level = 1;
    this.timeLimit = 0;
    this.isGameActive = false;
    this.gameTimer = null;

    // 게임 상태
    this.basketPosition = 1; // 0: Left, 1: Center, 2: Right
    this.items = []; // 떨어지는 아이템들 { type, lane, y, element }
    this.animationId = null;
    this.itemSpawnTimer = null;

    // 설정
    this.lanes = ["Left", "Center", "Right"];
    this.itemTypes = [
      { type: "apple", score: 100, speed: 5, probability: 0.6 },
      { type: "orange", score: 200, speed: 7, probability: 0.3 },
      { type: "bomb", score: 0, speed: 6, probability: 0.1 }
    ];

    // 콜백
    this.onScoreChange = null;
    this.onGameEnd = null;
    this.onGameStateUpdate = null; // UI 업데이트용
  }

  /**
   * 게임 시작
   */
  start(config = {}) {
    this.isGameActive = true;
    this.score = 0;
    this.level = 1;
    this.timeLimit = config.timeLimit || 60;
    this.basketPosition = 1; // 중앙 시작
    this.items = [];

    if (this.timeLimit > 0) {
      this.startTimer();
    }

    // 아이템 생성 시작
    this.spawnLoop();

    // 게임 루프 시작 (애니메이션)
    this.gameLoop();

    // 초기 UI 업데이트
    this.notifyStateUpdate();
  }

  /**
   * 게임 중지
   */
  stop() {
    this.isGameActive = false;
    this.clearTimer();

    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    if (this.itemSpawnTimer) {
      clearTimeout(this.itemSpawnTimer);
      this.itemSpawnTimer = null;
    }

    if (this.onGameEnd) {
      this.onGameEnd(this.score, this.level);
    }
  }

  /**
   * 타이머 시작
   */
  startTimer() {
    this.gameTimer = setInterval(() => {
      this.timeLimit--;
      this.notifyStateUpdate(); // 시간 업데이트 알림

      if (this.timeLimit <= 0) {
        this.stop();
      }
    }, 1000);
  }

  clearTimer() {
    if (this.gameTimer) {
      clearInterval(this.gameTimer);
      this.gameTimer = null;
    }
  }

  /**
   * 아이템 생성 루프
   */
  spawnLoop() {
    if (!this.isGameActive) return;

    // 레벨에 따른 생성 간격 조정 (기존보다 느리게 조정: 3초 시작)
    const spawnRate = Math.max(800, 3000 - (this.level * 400));

    this.spawnItem();

    this.itemSpawnTimer = setTimeout(() => {
      this.spawnLoop();
    }, spawnRate);
  }

  /**
   * 아이템 생성
   */
  spawnItem() {
    const laneIndex = Math.floor(Math.random() * 3);

    // 확률에 따라 아이템 타입 결정
    const rand = Math.random();
    let selectedType = this.itemTypes[0];
    let cumulativeProb = 0;

    for (const item of this.itemTypes) {
      cumulativeProb += item.probability;
      if (rand <= cumulativeProb) {
        selectedType = item;
        break;
      }
    }

    // 레벨 보정 (폭탄/오렌지 등장 조건)
    if (this.level < 2 && selectedType.type === "orange") selectedType = this.itemTypes[0];
    if (this.level < 3 && selectedType.type === "bomb") selectedType = this.itemTypes[0];

    const newItem = {
      id: Date.now() + Math.random(),
      type: selectedType.type,
      score: selectedType.score,
      speed: selectedType.speed + (this.level * 0.5), // 레벨업 시 속도 증가
      lane: laneIndex,
      y: -50, // 화면 위에서 시작
    };

    this.items.push(newItem);
  }

  /**
   * 메인 게임 루프 (60fps)
   */
  gameLoop() {
    if (!this.isGameActive) return;

    this.updateItems();
    this.checkCollisions();
    this.notifyStateUpdate(); // 화면 렌더링 요청

    this.animationId = requestAnimationFrame(() => this.gameLoop());
  }

  /**
   * 아이템 위치 업데이트 및 제거
   */
  updateItems() {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      item.y += item.speed;

      // 화면 밖으로 나가면 제거
      if (item.y > 600) { // 가정: 게임 화면 높이 600
        this.items.splice(i, 1);
      }
    }
  }

  /**
   * 충돌 체크
   */
  checkCollisions() {
    const catcherY = 500; // 바구니 Y 위치 (고정)
    const hitRange = 30; // 충돌 범위

    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];

      // Y축 충돌 확인
      if (Math.abs(item.y - catcherY) < hitRange) {
        // X축(레인) 일치 확인
        if (item.lane === this.basketPosition) {
          this.handleItemCollection(item);
          this.items.splice(i, 1);
        }
      }
    }
  }

  /**
   * 아이템 획득 처리
   */
  handleItemCollection(item) {
    if (item.type === "bomb") {
      this.stop(); // 게임 오버
      alert("폭탄을 받았습니다! 게임 오버!");
    } else {
      this.addScore(item.score);
      // 효과음 재생 로직 등을 여기에 추가 가능
    }
  }

  /**
   * 포즈 인식 결과 처리 (외부에서 호출)
   */
  onPoseDetected(detectedPose) {
    if (!this.isGameActive) return;

    // 포즈에 따라 바구니 위치 변경
    if (detectedPose === "Left") this.basketPosition = 0;
    else if (detectedPose === "Center") this.basketPosition = 1;
    else if (detectedPose === "Right") this.basketPosition = 2;
  }

  /**
   * 점수 추가 및 레벨업
   */
  addScore(points) {
    this.score += points;

    // 레벨업 (500점 단위)
    const newLevel = Math.floor(this.score / 500) + 1;
    if (newLevel > this.level) {
      this.level = newLevel;
      // 레벨업 알림 로직 가능
    }

    if (this.onScoreChange) {
      this.onScoreChange(this.score, this.level);
    }
  }

  // --- Callbacks setters ---
  setScoreChangeCallback(callback) { this.onScoreChange = callback; }
  setGameEndCallback(callback) { this.onGameEnd = callback; }
  setGameStateUpdateCallback(callback) { this.onGameStateUpdate = callback; }

  // 상태 알림
  notifyStateUpdate() {
    if (this.onGameStateUpdate) {
      this.onGameStateUpdate({
        basketPosition: this.basketPosition,
        items: this.items,
        timeLimit: this.timeLimit,
        score: this.score,
        level: this.level
      });
    }
  }
}

// 전역으로 내보내기
window.GameEngine = GameEngine;
