import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Trash2 } from 'lucide-react';

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 400;
const NEURON_RADIUS = 15;
const VISION_GRID_SIZE = 5;
const VISION_NEURON_SPACING = 40;
const VISION_START_X = 100;
const VISION_START_Y = 100;
const DEFAULT_WEIGHT = 0.5;
const DEFAULT_CONNECTION_PARAMS = {
  learningRate: 0.1,
  decay: 0.01
};

const DEFAULT_NEURON_PARAMS = {
  threshold: 0.5,
  timeConstant: 1.0,
  activity: 0,
  activation: 'sigmoid' // or 'relu' or 'threshold'
};

// Activation functions
const activationFunctions = {
  sigmoid: (x, threshold) => 1 / (1 + Math.exp(-(x - threshold))),
  relu: (x, threshold) => Math.max(0, x - threshold),
  threshold: (x, threshold) => x > threshold ? 1 : 0
};

const NeuralNetworkEditor = ({ networkState, setNetworkState, isLearning }) => {
  // Network state
  const [neurons, setNeurons] = useState({
    input: [], // Vision neurons + reward neuron
    hidden: [], // User-added hidden neurons
    output: []  // Movement neurons
  });
  const [connections, setConnections] = useState([]);
  const [selectedNeuron, setSelectedNeuron] = useState(null);
  const [selectedConnection, setSelectedConnection] = useState(null);
  const [learningRate, setLearningRate] = useState(0.1);
  const [mode, setMode] = useState('add'); // 'add' or 'delete'
  
  const canvasRef = useRef(null);
  const isDraggingRef = useRef(false);

  // Initialize input and output neurons
  useEffect(() => {
    // Initialize vision neurons (5x5 grid)
    const visionNeurons = [];
    for (let y = 0; y < VISION_GRID_SIZE; y++) {
      for (let x = 0; x < VISION_GRID_SIZE; x++) {
        visionNeurons.push({
          id: `vision_${x}_${y}`,
          x: VISION_START_X + x * VISION_NEURON_SPACING,
          y: VISION_START_Y + y * VISION_NEURON_SPACING,
          type: 'input',
          subtype: 'vision',
          activity: 0
        });
      }
    }

    // Add reward neuron below vision grid
    visionNeurons.push({
      id: 'reward',
      x: VISION_START_X + (VISION_GRID_SIZE * VISION_NEURON_SPACING) / 2,
      y: VISION_START_Y + (VISION_GRID_SIZE * VISION_NEURON_SPACING) + 50,
      type: 'input',
      subtype: 'reward',
      activity: 0
    });

    // Initialize output neurons on the right side
    const outputPositionY = VISION_START_Y + (VISION_GRID_SIZE * VISION_NEURON_SPACING) / 2;
    const outputStartX = CANVAS_WIDTH - 100;  // Fixed X position on the right
    const outputSpacing = 50;  // Vertical spacing between output neurons
    
    const outputNeurons = [
      { id: 'up', x: outputStartX, y: outputPositionY - outputSpacing },
      { id: 'down', x: outputStartX, y: outputPositionY + outputSpacing },
      { id: 'left', x: outputStartX - outputSpacing, y: outputPositionY },
      { id: 'right', x: outputStartX + outputSpacing, y: outputPositionY }
    ].map(n => ({ ...n, type: 'output', activity: 0 }));

    setNeurons({
      input: visionNeurons,
      hidden: [],
      output: outputNeurons
    });
  }, []);

  // Create default connections for a new hidden neuron
  const createDefaultConnections = (hiddenNeuronId) => {
    const newConnections = [];
    
    // Connect all input neurons to the new hidden neuron
    neurons.input.forEach(inputNeuron => {
      newConnections.push({
        from: inputNeuron.id,
        to: hiddenNeuronId,
        weight: DEFAULT_WEIGHT
      });
    });

    // Connect the new hidden neuron to all output neurons
    neurons.output.forEach(outputNeuron => {
      newConnections.push({
        from: hiddenNeuronId,
        to: outputNeuron.id,
        weight: DEFAULT_WEIGHT
      });
    });

    return newConnections;
  };

  // Draw network
  const drawNetwork = () => {
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw connections with activity flow
    connections.forEach(conn => {
      const from = [...neurons.input, ...neurons.hidden, ...neurons.output]
        .find(n => n.id === conn.from);
      const to = [...neurons.input, ...neurons.hidden, ...neurons.output]
        .find(n => n.id === conn.to);
      
      if (from && to) {
        // Calculate arrow points
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const angle = Math.atan2(dy, dx);
        const length = Math.sqrt(dx * dx + dy * dy);
        
        const arrowLength = 10;
        const arrowWidth = 5;
        
        const endX = from.x + dx * (1 - NEURON_RADIUS / length);
        const endY = from.y + dy * (1 - NEURON_RADIUS / length);
        const startX = from.x + dx * (NEURON_RADIUS / length);
        const startY = from.y + dy * (NEURON_RADIUS / length);

        // Draw connection line with gradient based on activity flow
        const gradient = ctx.createLinearGradient(startX, startY, endX, endY);
        const activityColor = `rgba(255, 255, 0, ${from.activity})`; // Yellow for activity
        gradient.addColorStop(0, activityColor);
        gradient.addColorStop(1, 'rgba(153, 153, 153, 0.6)');

        // Draw connection with width based on weight
        ctx.beginPath();
        ctx.strokeStyle = selectedConnection === conn ? '#FF0000' : gradient;
        ctx.lineWidth = Math.abs(conn.weight) * 5;
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        // Draw arrow head
        ctx.beginPath();
        ctx.moveTo(endX, endY);
        ctx.lineTo(
          endX - arrowLength * Math.cos(angle - Math.PI / 6),
          endY - arrowLength * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
          endX - arrowLength * Math.cos(angle + Math.PI / 6),
          endY - arrowLength * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fillStyle = selectedConnection === conn ? '#FF0000' : '#999';
        ctx.fill();

        // Draw weight value
        if (selectedConnection === conn || Math.abs(conn.weight) > 0.3) {
          const midX = (from.x + to.x) / 2;
          const midY = (from.y + to.y) / 2;
          ctx.fillStyle = '#000';
          ctx.font = '12px Arial';
          ctx.fillText(conn.weight.toFixed(2), midX, midY);
        }
      }
    });

    // Draw neurons with activity visualization
    const drawNeuron = (neuron, isSelected = false) => {
      // Draw activity halo
      if (neuron.activity > 0) {
        ctx.beginPath();
        ctx.arc(neuron.x, neuron.y, NEURON_RADIUS + 5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 0, ${neuron.activity * 0.5})`;
        ctx.fill();
      }

      // Draw base neuron circle
      ctx.beginPath();
      ctx.arc(neuron.x, neuron.y, NEURON_RADIUS, 0, Math.PI * 2);
      
      // Set color based on neuron type
      if (neuron.type === 'input') {
        if (neuron.subtype === 'reward') {
          ctx.fillStyle = '#FFD700';
        } else {
          ctx.fillStyle = '#4CAF50';
        }
      } else if (neuron.type === 'output') {
        ctx.fillStyle = '#2196F3';
      } else {
        ctx.fillStyle = '#9C27B0';
      }
      
      if (isSelected) {
        ctx.strokeStyle = '#FF0000';
        ctx.lineWidth = 2;
      } else {
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
      }
      
      ctx.fill();
      ctx.stroke();

      // Draw activity level as inner fill
      const activityRadius = neuron.activity * NEURON_RADIUS;
      if (activityRadius > 0) {
        ctx.beginPath();
        ctx.arc(neuron.x, neuron.y, activityRadius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fill();
      }

      // Draw activity value
      if (neuron.activity > 0.1) {
        ctx.fillStyle = '#000';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(neuron.activity.toFixed(2), neuron.x, neuron.y + NEURON_RADIUS + 15);
      }
    };

    // Draw all neurons
    [...neurons.input, ...neurons.hidden, ...neurons.output].forEach(neuron => {
      drawNeuron(neuron, selectedNeuron?.id === neuron.id);
    });

    // Draw weight map for selected neuron
    if (selectedNeuron) {
      drawWeightMap(selectedNeuron);
    }
  };

  // Draw weight map visualization
  const drawWeightMap = (neuron) => {
    const WEIGHT_MAP_SIZE = 120;
    const WEIGHT_MAP_X = 20;
    const WEIGHT_MAP_Y = CANVAS_HEIGHT - WEIGHT_MAP_SIZE - 20;

    // Draw background
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(WEIGHT_MAP_X, WEIGHT_MAP_Y, WEIGHT_MAP_SIZE, WEIGHT_MAP_SIZE);
    ctx.strokeStyle = '#000';
    ctx.strokeRect(WEIGHT_MAP_X, WEIGHT_MAP_Y, WEIGHT_MAP_SIZE, WEIGHT_MAP_SIZE);

    // Get incoming and outgoing connections
    const incomingConnections = connections.filter(conn => conn.to === neuron.id);
    const outgoingConnections = connections.filter(conn => conn.from === neuron.id);

    // Draw title
    ctx.fillStyle = '#000';
    ctx.font = '12px Arial';
    ctx.fillText(`Weight Map - ${neuron.id}`, WEIGHT_MAP_X, WEIGHT_MAP_Y - 5);

    // Draw incoming weights
    if (incomingConnections.length > 0) {
      const cellSize = WEIGHT_MAP_SIZE / Math.ceil(Math.sqrt(incomingConnections.length));
      incomingConnections.forEach((conn, i) => {
        const row = Math.floor(i / Math.ceil(Math.sqrt(incomingConnections.length)));
        const col = i % Math.ceil(Math.sqrt(incomingConnections.length));
        const x = WEIGHT_MAP_X + col * cellSize;
        const y = WEIGHT_MAP_Y + row * cellSize;

        // Color based on weight (-1 to 1 mapped to color)
        const colorValue = Math.floor((conn.weight + 1) * 127.5);
        ctx.fillStyle = conn.weight >= 0 
          ? `rgb(${colorValue}, ${colorValue}, 255)` 
          : `rgb(255, ${colorValue}, ${colorValue})`;
        ctx.fillRect(x, y, cellSize, cellSize);
        
        // Draw weight value
        ctx.fillStyle = '#000';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(conn.weight.toFixed(2), x + cellSize/2, y + cellSize/2);
      });
    }

    // Draw all neurons
    [...neurons.input, ...neurons.hidden, ...neurons.output].forEach(neuron => {
      drawNeuron(neuron, selectedNeuron?.id === neuron.id);
    });
  };

  // Handle mouse events
  const handleMouseDown = (event) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Find clicked neuron
    const clickedNeuron = [...neurons.input, ...neurons.hidden, ...neurons.output]
      .find(n => Math.hypot(n.x - x, n.y - y) < NEURON_RADIUS);

    // Find clicked connection
    const clickedConnection = connections.find(conn => {
      const from = [...neurons.input, ...neurons.hidden, ...neurons.output]
        .find(n => n.id === conn.from);
      const to = [...neurons.input, ...neurons.hidden, ...neurons.output]
        .find(n => n.id === conn.to);
      if (!from || !to) return false;

      const A = to.y - from.y;
      const B = from.x - to.x;
      const C = to.x * from.y - from.x * to.y;
      const distance = Math.abs(A * x + B * y + C) / Math.sqrt(A * A + B * B);
      return distance < 5 && 
             x >= Math.min(from.x, to.x) - 5 && 
             x <= Math.max(from.x, to.x) + 5 &&
             y >= Math.min(from.y, to.y) - 5 && 
             y <= Math.max(from.y, to.y) + 5;
    });

    if (mode === 'delete') {
      if (clickedNeuron?.type === 'hidden') {
        // Delete hidden neuron and its connections
        setNeurons(prev => ({
          ...prev,
          hidden: prev.hidden.filter(n => n.id !== clickedNeuron.id)
        }));
        setConnections(prev => 
          prev.filter(c => c.from !== clickedNeuron.id && c.to !== clickedNeuron.id)
        );
      } else if (clickedConnection) {
        // Delete connection
        setConnections(prev => 
          prev.filter(c => c !== clickedConnection)
        );
      }
    } else {
      if (clickedNeuron) {
        if (selectedNeuron && selectedNeuron !== clickedNeuron) {
          // Create new connection if it doesn't exist
          const connectionExists = connections.some(
            c => c.from === selectedNeuron.id && c.to === clickedNeuron.id ||
                 c.from === clickedNeuron.id && c.to === selectedNeuron.id
          );
          
          if (!connectionExists) {
            setConnections(prev => [...prev, {
              from: selectedNeuron.id,
              to: clickedNeuron.id,
              weight: DEFAULT_WEIGHT
            }]);
          }
          setSelectedNeuron(null);
        } else {
          setSelectedNeuron(clickedNeuron);
          setSelectedConnection(null);
        }
      } else if (clickedConnection) {
        setSelectedConnection(clickedConnection);
        setSelectedNeuron(null);
      } else {
        // Add new hidden neuron
        const newNeuron = {
          id: `hidden_${Date.now()}`,
          x,
          y,
          type: 'hidden',
          activity: 0
        };
        
        setNeurons(prev => ({
          ...prev,
          hidden: [...prev.hidden, newNeuron]
        }));

        // Create default connections
        const newConnections = createDefaultConnections(newNeuron.id);
        setConnections(prev => [...prev, ...newConnections]);
      }
    }
  };

  // Handle connection weight adjustment
  const adjustSelectedConnectionWeight = (delta) => {
    if (selectedConnection) {
      setConnections(prev => prev.map(conn => 
        conn === selectedConnection
          ? { ...conn, weight: Math.max(-1, Math.min(1, conn.weight + delta)) }
          : conn
      ));
    }
  };

  // Update canvas when network changes
  useEffect(() => {
    if (canvasRef.current) {
      drawNetwork();
    }
  }, [neurons, connections, selectedNeuron, selectedConnection, mode]);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4 mb-4">
            <Button
              onClick={() => setMode(mode === 'add' ? 'delete' : 'add')}
              variant={mode === 'delete' ? "destructive" : "default"}
            >
              {mode === 'add' ? 'Add Mode' : 'Delete Mode'}
            </Button>
            {selectedConnection && (
              <div className="flex gap-2 items-center">
                <Button size="sm" onClick={() => adjustSelectedConnectionWeight(-0.1)}>-</Button>
                <span>Weight: {selectedConnection.weight.toFixed(2)}</span>
                <Button size="sm" onClick={() => adjustSelectedConnectionWeight(0.1)}>+</Button>
              </div>
            )}
          </div>
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            onClick={handleMouseDown}
            className="border border-gray-200 cursor-crosshair"
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-4">
          {(selectedConnection || selectedNeuron?.type === 'hidden') && (
            <div className="space-y-4">
              {selectedConnection && (
                <>
                  <h3 className="text-sm font-medium">Connection Parameters</h3>
                  
                  <div>
                    <h4 className="text-xs mb-2">Learning Rate</h4>
                    <Slider
                      value={[selectedConnection.learningRate]}
                      onValueChange={([value]) => {
                        setConnections(prev => prev.map(conn => 
                          conn === selectedConnection 
                            ? { ...conn, learningRate: value }
                            : conn
                        ));
                      }}
                      min={0}
                      max={1}
                      step={0.1}
                    />
                  </div>

                  <div>
                    <h4 className="text-xs mb-2">Decay Rate</h4>
                    <Slider
                      value={[selectedConnection.decay]}
                      onValueChange={([value]) => {
                        setConnections(prev => prev.map(conn => 
                          conn === selectedConnection 
                            ? { ...conn, decay: value }
                            : conn
                        ));
                      }}
                      min={0}
                      max={0.5}
                      step={0.01}
                    />
                  </div>
                </>
              )}

              {selectedNeuron?.type === 'hidden' && (
                <>
                  <h3 className="text-sm font-medium">Neuron Parameters</h3>
                  
                  <div>
                    <h4 className="text-xs mb-2">Activation Threshold</h4>
                    <Slider
                      value={[selectedNeuron.threshold]}
                      onValueChange={([value]) => {
                        setNeurons(prev => ({
                          ...prev,
                          hidden: prev.hidden.map(n => 
                            n.id === selectedNeuron.id 
                              ? { ...n, threshold: value }
                              : n
                          )
                        }));
                      }}
                      min={0}
                      max={1}
                      step={0.1}
                    />
                  </div>

                  <div>
                    <h4 className="text-xs mb-2">Time Constant</h4>
                    <Slider
                      value={[selectedNeuron.timeConstant]}
                      onValueChange={([value]) => {
                        setNeurons(prev => ({
                          ...prev,
                          hidden: prev.hidden.map(n => 
                            n.id === selectedNeuron.id 
                              ? { ...n, timeConstant: value }
                              : n
                          )
                        }));
                      }}
                      min={0.1}
                      max={5}
                      step={0.1}
                    />
                  </div>

                  <div>
                    <h4 className="text-xs mb-2">Activation Function</h4>
                    <select
                      className="w-full p-2 border rounded"
                      value={selectedNeuron.activation}
                      onChange={(e) => {
                        setNeurons(prev => ({
                          ...prev,
                          hidden: prev.hidden.map(n => 
                            n.id === selectedNeuron.id 
                              ? { ...n, activation: e.target.value }
                              : n
                          )
                        }));
                      }}
                    >
                      <option value="sigmoid">Sigmoid</option>
                      <option value="relu">ReLU</option>
                      <option value="threshold">Threshold</option>
                    </select>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="flex justify-between items-center">
            <div className="text-sm space-y-1">
              <div>Hidden Neurons: {neurons.hidden.length}</div>
              <div>Connections: {connections.length}</div>
              {selectedNeuron && (
                <div>Selected: {selectedNeuron.id}</div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default NeuralNetworkEditor;