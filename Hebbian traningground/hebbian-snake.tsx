import React, { useState, useEffect, useCallback } from 'react';
import SnakePlayground from './SnakePlayground';
import NeuralNetworkEditor from './NeuralNetworkEditor';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlayCircle, PauseCircle, RotateCcw } from 'lucide-react';

const DEFAULT_NETWORK_STATE = {
  neurons: {
    input: [],  // Will be initialized with vision + reward neurons
    hidden: [], // User-added hidden neurons
    output: []  // Movement neurons (up, down, left, right)
  },
  connections: []
};

const HebbianSnake = () => {
  const [isLearning, setIsLearning] = useState(false);
  const [networkState, setNetworkState] = useState(DEFAULT_NETWORK_STATE);
  const [lastUpdateTime, setLastUpdateTime] = useState(Date.now());

  // Initialize network with default neurons
  useEffect(() => {
    // Create vision neurons (5x5 grid)
    const visionNeurons = [];
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        visionNeurons.push({
          id: `vision_${x}_${y}`,
          type: 'input',
          subtype: 'vision',
          activity: 0
        });
      }
    }

    // Add reward neuron
    visionNeurons.push({
      id: 'reward',
      type: 'input',
      subtype: 'reward',
      activity: 0
    });

    // Create output neurons
    const outputNeurons = ['up', 'down', 'left', 'right'].map(direction => ({
      id: direction,
      type: 'output',
      activity: 0
    }));

    setNetworkState(prev => ({
      ...prev,
      neurons: {
        ...prev.neurons,
        input: visionNeurons,
        output: outputNeurons
      }
    }));
  }, []);

  // Update network inputs based on game state
  const updateNetworkInputs = useCallback((visionGrid, hasReward) => {
    if (!networkState) return;

    setNetworkState(prev => {
      const newInputNeurons = [...prev.neurons.input];
      
      // Update vision neuron activities
      visionGrid.forEach((row, y) => {
        row.forEach((cell, x) => {
          const neuronIndex = y * 5 + x;
          if (newInputNeurons[neuronIndex]) {
            newInputNeurons[neuronIndex] = {
              ...newInputNeurons[neuronIndex],
              activity: cell
            };
          }
        });
      });

      // Update reward neuron activity
      const rewardNeuron = newInputNeurons.find(n => n.id === 'reward');
      if (rewardNeuron) {
        rewardNeuron.activity = hasReward ? 1 : 0;
      }

      return {
        ...prev,
        neurons: {
          ...prev.neurons,
          input: newInputNeurons
        }
      };
    });
  }, [networkState]);

  // Get movement direction from network outputs
  const getNextMove = useCallback(() => {
    if (!networkState?.neurons?.output) return 'right';

    const outputNeurons = networkState.neurons.output;
    const maxOutput = outputNeurons.reduce(
      (max, neuron) => neuron.activity > max.activity ? neuron : max,
      outputNeurons[0]
    );

    return maxOutput.id;
  }, [networkState]);

  // Network update loop
  useEffect(() => {
    if (!isLearning) return;

    const updateLoop = () => {
      const currentTime = Date.now();
      const dt = (currentTime - lastUpdateTime) / 1000; // Convert to seconds
      setLastUpdateTime(currentTime);

      setNetworkState(prev => {
        // Deep copy the network state
        const newState = JSON.parse(JSON.stringify(prev));

        // Update neuron activities
        const allNeurons = [...newState.neurons.input, ...newState.neurons.hidden, ...newState.neurons.output];
        
        // First pass: Calculate new activities
        allNeurons.forEach(neuron => {
          if (neuron.type !== 'input') { // Don't update input neurons' activities
            const incomingConnections = newState.connections.filter(c => c.to === neuron.id);
            const totalInput = incomingConnections.reduce((sum, conn) => {
              const sourceNeuron = allNeurons.find(n => n.id === conn.from);
              return sum + (sourceNeuron ? sourceNeuron.activity * conn.weight : 0);
            }, 0);

            // Apply activation function and time constant
            if (neuron.type === 'hidden') {
              const dA = (-neuron.activity + totalInput) / neuron.timeConstant;
              neuron.activity = neuron.activity + dA * dt;
              
              // Apply activation function
              if (neuron.activation === 'sigmoid') {
                neuron.activity = 1 / (1 + Math.exp(-(neuron.activity - neuron.threshold)));
              } else if (neuron.activation === 'relu') {
                neuron.activity = Math.max(0, neuron.activity - neuron.threshold);
              } else { // threshold
                neuron.activity = neuron.activity > neuron.threshold ? 1 : 0;
              }
            } else {
              // Output neurons use simple linear activation
              neuron.activity = Math.max(0, Math.min(1, totalInput));
            }
          }
        });

        // Second pass: Update weights based on Hebbian learning
        newState.connections.forEach(conn => {
          const preNeuron = allNeurons.find(n => n.id === conn.from);
          const postNeuron = allNeurons.find(n => n.id === conn.to);

          if (preNeuron && postNeuron) {
            // Hebbian update
            const deltaW = conn.learningRate * preNeuron.activity * postNeuron.activity;
            
            // Apply decay
            const decayFactor = 1 - conn.decay;
            
            // Update weight with bounds
            conn.weight = Math.max(-1, Math.min(1, 
              conn.weight * decayFactor + deltaW
            ));
          }
        });

        return newState;
      });
    };

    const intervalId = setInterval(updateLoop, 50); // 20 updates per second
    return () => clearInterval(intervalId);
  }, [isLearning, lastUpdateTime]);

  return (
    <div className="p-4 space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4 items-center">
            <Button
              onClick={() => setIsLearning(!isLearning)}
              variant={isLearning ? "destructive" : "default"}
            >
              {isLearning ? <PauseCircle className="mr-2" /> : <PlayCircle className="mr-2" />}
              {isLearning ? "Stop Learning" : "Start Learning"}
            </Button>
            <Button
              onClick={() => {
                setIsLearning(false);
                setNetworkState(DEFAULT_NETWORK_STATE);
              }}
              variant="outline"
            >
              <RotateCcw className="mr-2" />
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SnakePlayground
          onVisionUpdate={updateNetworkInputs}
          getNextMove={getNextMove}
          isRunning={isLearning}
        />
        <NeuralNetworkEditor
          networkState={networkState}
          setNetworkState={setNetworkState}
          isLearning={isLearning}
        />
      </div>
    </div>
  );
};

export default HebbianSnake;