import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';

const GRID_SIZE = 20;
const CELL_SIZE = 20;
const VISION_SIZE = 5;

const SnakePlayground = ({ onVisionUpdate, getNextMove, isRunning }) => {
  // Game state
  const [snake, setSnake] = useState({ x: 10, y: 10, direction: 'right' });
  const [rewards, setRewards] = useState([]);
  const [stats, setStats] = useState({ rewardsCollected: 0, moves: 0 });
  
  // Configuration state
  const [rewardDensity, setRewardDensity] = useState(5);
  const [gameSpeed, setGameSpeed] = useState(200);
  
  const canvasRef = useRef(null);
  const gameLoopRef = useRef(null);

  // Initialize rewards
  const spawnRewards = () => {
    const newRewards = [];
    for (let i = 0; i < rewardDensity; i++) {
      newRewards.push({
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE)
      });
    }
    setRewards(newRewards);
  };

  // Get 5x5 vision grid around snake
  const getVisionGrid = () => {
    const vision = Array(VISION_SIZE).fill().map(() => Array(VISION_SIZE).fill(0));
    const offset = Math.floor(VISION_SIZE / 2);
    
    for (let y = 0; y < VISION_SIZE; y++) {
      for (let x = 0; x < VISION_SIZE; x++) {
        const worldX = snake.x - offset + x;
        const worldY = snake.y - offset + y;
        
        // Check if position is within bounds and contains reward
        if (worldX >= 0 && worldX < GRID_SIZE && worldY >= 0 && worldY < GRID_SIZE) {
          if (rewards.some(r => r.x === worldX && r.y === worldY)) {
            vision[y][x] = 1;
          }
        }
      }
    }
    return vision;
  };

  // Update game state
  const updateGame = () => {
    setStats(prev => ({ ...prev, moves: prev.moves + 1 }));
    
    // Get vision grid and reward status
    const visionGrid = getVisionGrid();
    const hasReward = rewards.some(r => 
      Math.abs(r.x - snake.x) <= 2 && Math.abs(r.y - snake.y) <= 2
    );

    // Update neural network
    onVisionUpdate(visionGrid, hasReward);

    // Get next move from network
    const nextMove = getNextMove();
    
    // Update snake position based on direction
    const newSnake = { ...snake };
    switch (nextMove) {
      case 'up':
        newSnake.y = (newSnake.y - 1 + GRID_SIZE) % GRID_SIZE;
        break;
      case 'down':
        newSnake.y = (newSnake.y + 1) % GRID_SIZE;
        break;
      case 'left':
        newSnake.x = (newSnake.x - 1 + GRID_SIZE) % GRID_SIZE;
        break;
      case 'right':
        newSnake.x = (newSnake.x + 1) % GRID_SIZE;
        break;
    }
    newSnake.direction = nextMove;
    setSnake(newSnake);
    
    // Check for reward collection
    const rewardIndex = rewards.findIndex(r => r.x === newSnake.x && r.y === newSnake.y);
    if (rewardIndex !== -1) {
      setStats(prev => ({ ...prev, rewardsCollected: prev.rewardsCollected + 1 }));
      const newRewards = [...rewards];
      newRewards.splice(rewardIndex, 1);
      newRewards.push({
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE)
      });
      setRewards(newRewards);
    }
  };

  // Render game
  const renderGame = () => {
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, GRID_SIZE * CELL_SIZE, GRID_SIZE * CELL_SIZE);

    // Draw grid
    ctx.strokeStyle = '#ddd';
    for (let i = 0; i <= GRID_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL_SIZE, 0);
      ctx.lineTo(i * CELL_SIZE, GRID_SIZE * CELL_SIZE);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * CELL_SIZE);
      ctx.lineTo(GRID_SIZE * CELL_SIZE, i * CELL_SIZE);
      ctx.stroke();
    }

    // Draw rewards
    ctx.fillStyle = '#FFD700';
    rewards.forEach(reward => {
      ctx.beginPath();
      ctx.arc(
        reward.x * CELL_SIZE + CELL_SIZE/2,
        reward.y * CELL_SIZE + CELL_SIZE/2,
        CELL_SIZE/3,
        0,
        Math.PI * 2
      );
      ctx.fill();
    });

    // Draw snake
    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(
      snake.x * CELL_SIZE,
      snake.y * CELL_SIZE,
      CELL_SIZE,
      CELL_SIZE
    );

    // Draw vision grid
    ctx.strokeStyle = '#FF000066';
    const offset = Math.floor(VISION_SIZE / 2);
    ctx.strokeRect(
      (snake.x - offset) * CELL_SIZE,
      (snake.y - offset) * CELL_SIZE,
      VISION_SIZE * CELL_SIZE,
      VISION_SIZE * CELL_SIZE
    );
  };

  // Game loop
  useEffect(() => {
    if (isRunning) {
      gameLoopRef.current = setInterval(() => {
        updateGame();
      }, gameSpeed);
    }
    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    };
  }, [isRunning, gameSpeed, snake, rewards]);

  // Render loop
  useEffect(() => {
    if (canvasRef.current) {
      renderGame();
    }
  }, [snake, rewards]);

  // Initialize game
  useEffect(() => {
    spawnRewards();
  }, [rewardDensity]);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="p-4">
          <canvas
            ref={canvasRef}
            width={GRID_SIZE * CELL_SIZE}
            height={GRID_SIZE * CELL_SIZE}
            className="border border-gray-200"
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div>
            <h3 className="text-sm font-medium mb-2">Reward Density</h3>
            <Slider
              value={[rewardDensity]}
              onValueChange={([value]) => setRewardDensity(value)}
              min={1}
              max={20}
              step={1}
            />
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2">Game Speed (ms per move)</h3>
            <Slider
              value={[gameSpeed]}
              onValueChange={([value]) => setGameSpeed(value)}
              min={50}
              max={500}
              step={50}
            />
          </div>

          <div className="text-sm space-y-1">
            <div>Rewards Collected: {stats.rewardsCollected}</div>
            <div>Moves: {stats.moves}</div>
            <div>Reward Rate: {(stats.rewardsCollected / stats.moves || 0).toFixed(3)}</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SnakePlayground;