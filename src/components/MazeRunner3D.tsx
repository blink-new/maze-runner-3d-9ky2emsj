import React, { useRef, useState, useEffect, useCallback } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Text, Box } from '@react-three/drei'
import * as THREE from 'three'

// Maze layout (1 = wall, 0 = path, 2 = checkpoint)
const MAZE_LAYOUT = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 2, 1],
  [1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1],
  [1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1],
  [1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1],
  [1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1],
  [1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 1],
  [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 2, 1],
  [1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
]

const WALL_HEIGHT = 3
const WALL_SIZE = 2

interface GameState {
  checkpointsCollected: number
  totalCheckpoints: number
  gameTime: number
  isGameActive: boolean
  isGameWon: boolean
}

interface PlayerProps {
  onCheckpointCollect: () => void
  gameState: GameState
}

function MouseLookControls() {
  const { camera, gl } = useThree()
  const [isActive, setIsActive] = useState(false)
  const mouseRef = useRef({ x: 0, y: 0 })
  const rotationRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!isActive) return

      const movementX = event.movementX || 0
      const movementY = event.movementY || 0

      rotationRef.current.y -= movementX * 0.002
      rotationRef.current.x -= movementY * 0.002

      // Limit vertical rotation
      rotationRef.current.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotationRef.current.x))

      // Apply rotation to camera
      camera.rotation.order = 'YXZ'
      camera.rotation.y = rotationRef.current.y
      camera.rotation.x = rotationRef.current.x
    }

    const handleClick = () => {
      setIsActive(true)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Escape') {
        setIsActive(false)
      }
    }

    const canvas = gl.domElement
    canvas.addEventListener('click', handleClick)
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      canvas.removeEventListener('click', handleClick)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [camera, gl, isActive])

  return (
    <>
      {!isActive && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div className="bg-black/70 backdrop-blur-sm rounded-lg px-6 py-4 text-white text-center pointer-events-auto">
            <p className="text-lg mb-2">🖱️ Click to look around</p>
            <p className="text-sm text-gray-300">Press ESC to release mouse</p>
          </div>
        </div>
      )}
    </>
  )
}

function Player({ onCheckpointCollect, gameState }: PlayerProps) {
  const { camera } = useThree()
  const velocity = useRef(new THREE.Vector3())
  const direction = useRef(new THREE.Vector3())
  const prevTime = useRef(performance.now())

  const keys = useRef({
    w: false,
    a: false,
    s: false,
    d: false,
  })

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.code.toLowerCase()
      if (key === 'keyw') keys.current.w = true
      if (key === 'keya') keys.current.a = true
      if (key === 'keys') keys.current.s = true
      if (key === 'keyd') keys.current.d = true
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      const key = event.code.toLowerCase()
      if (key === 'keyw') keys.current.w = false
      if (key === 'keya') keys.current.a = false
      if (key === 'keys') keys.current.s = false
      if (key === 'keyd') keys.current.d = false
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('keyup', handleKeyUp)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  const checkCollision = useCallback((position: THREE.Vector3) => {
    const x = Math.floor((position.x + WALL_SIZE / 2) / WALL_SIZE)
    const z = Math.floor((position.z + WALL_SIZE / 2) / WALL_SIZE)
    
    if (x < 0 || x >= MAZE_LAYOUT[0].length || z < 0 || z >= MAZE_LAYOUT.length) {
      return true
    }
    
    return MAZE_LAYOUT[z][x] === 1
  }, [])

  const checkCheckpoint = useCallback((position: THREE.Vector3) => {
    const x = Math.floor((position.x + WALL_SIZE / 2) / WALL_SIZE)
    const z = Math.floor((position.z + WALL_SIZE / 2) / WALL_SIZE)
    
    if (x >= 0 && x < MAZE_LAYOUT[0].length && z >= 0 && z < MAZE_LAYOUT.length) {
      if (MAZE_LAYOUT[z][x] === 2) {
        MAZE_LAYOUT[z][x] = 0 // Remove checkpoint
        onCheckpointCollect()
      }
    }
  }, [onCheckpointCollect])

  useFrame(() => {
    if (!gameState.isGameActive) return

    const time = performance.now()
    const delta = (time - prevTime.current) / 1000
    prevTime.current = time

    velocity.current.x -= velocity.current.x * 10.0 * delta
    velocity.current.z -= velocity.current.z * 10.0 * delta

    direction.current.z = Number(keys.current.w) - Number(keys.current.s)
    direction.current.x = Number(keys.current.d) - Number(keys.current.a)
    direction.current.normalize()

    if (keys.current.w || keys.current.s) velocity.current.z -= direction.current.z * 400.0 * delta
    if (keys.current.a || keys.current.d) velocity.current.x -= direction.current.x * 400.0 * delta

    const newPosition = camera.position.clone()
    newPosition.x += velocity.current.x * delta
    newPosition.z += velocity.current.z * delta

    // Check collision for X movement
    const testPositionX = camera.position.clone()
    testPositionX.x = newPosition.x
    if (!checkCollision(testPositionX)) {
      camera.position.x = newPosition.x
    }

    // Check collision for Z movement
    const testPositionZ = camera.position.clone()
    testPositionZ.z = newPosition.z
    if (!checkCollision(testPositionZ)) {
      camera.position.z = newPosition.z
    }

    // Check for checkpoint collection
    checkCheckpoint(camera.position)
  })

  return null
}

function MazeWalls() {
  const walls = []
  const checkpoints = []

  for (let z = 0; z < MAZE_LAYOUT.length; z++) {
    for (let x = 0; x < MAZE_LAYOUT[z].length; x++) {
      const cell = MAZE_LAYOUT[z][x]
      const posX = x * WALL_SIZE
      const posZ = z * WALL_SIZE

      if (cell === 1) {
        walls.push(
          <Box
            key={`wall-${x}-${z}`}
            position={[posX, WALL_HEIGHT / 2, posZ]}
            args={[WALL_SIZE, WALL_HEIGHT, WALL_SIZE]}
          >
            <meshStandardMaterial color="#8B4513" roughness={0.8} metalness={0.1} />
          </Box>
        )
      } else if (cell === 2) {
        checkpoints.push(
          <group key={`checkpoint-${x}-${z}`} position={[posX, 1, posZ]}>
            <Box args={[0.5, 2, 0.5]}>
              <meshStandardMaterial color="#FFD700" emissive="#FFD700" emissiveIntensity={0.3} />
            </Box>
            <Text
              position={[0, 2.5, 0]}
              fontSize={0.5}
              color="#FFD700"
              anchorX="center"
              anchorY="middle"
            >
              ★
            </Text>
          </group>
        )
      }
    }
  }

  return (
    <>
      {walls}
      {checkpoints}
      {/* Ground */}
      <Box position={[MAZE_LAYOUT[0].length, -0.5, MAZE_LAYOUT.length]} args={[MAZE_LAYOUT[0].length * 2, 1, MAZE_LAYOUT.length * 2]}>
        <meshStandardMaterial color="#2D2D2D" roughness={0.9} />
      </Box>
    </>
  )
}

function GameHUD({ gameState }: { gameState: GameState }) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="fixed inset-0 pointer-events-none z-10">
      {/* Timer and Checkpoints */}
      <div className="absolute top-6 left-6 text-white font-medium">
        <div className="bg-black/50 backdrop-blur-sm rounded-lg px-4 py-2 mb-2">
          <div className="text-lg">⏱️ {formatTime(gameState.gameTime)}</div>
        </div>
        <div className="bg-black/50 backdrop-blur-sm rounded-lg px-4 py-2">
          <div className="text-lg">⭐ {gameState.checkpointsCollected}/{gameState.totalCheckpoints}</div>
        </div>
      </div>

      {/* Controls */}
      <div className="absolute bottom-6 left-6 text-white/70 text-sm">
        <div className="bg-black/30 backdrop-blur-sm rounded-lg px-4 py-2">
          <div>WASD - Move</div>
          <div>Click + Mouse - Look around</div>
          <div>ESC - Release mouse</div>
        </div>
      </div>

      {/* Victory Screen */}
      {gameState.isGameWon && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center pointer-events-auto">
          <div className="text-center text-white">
            <h1 className="text-6xl font-bold mb-4 text-yellow-400">🏆 Victory!</h1>
            <p className="text-2xl mb-2">Maze Completed!</p>
            <p className="text-xl mb-6">Time: {formatTime(gameState.gameTime)}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-3 px-6 rounded-lg text-lg transition-colors"
            >
              Play Again
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function MazeRunner3D() {
  const [gameState, setGameState] = useState<GameState>({
    checkpointsCollected: 0,
    totalCheckpoints: MAZE_LAYOUT.flat().filter(cell => cell === 2).length,
    gameTime: 0,
    isGameActive: false,
    isGameWon: false,
  })

  const [isStarted, setIsStarted] = useState(false)

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (gameState.isGameActive && !gameState.isGameWon) {
      interval = setInterval(() => {
        setGameState(prev => ({ ...prev, gameTime: prev.gameTime + 1 }))
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [gameState.isGameActive, gameState.isGameWon])

  const handleCheckpointCollect = useCallback(() => {
    setGameState(prev => {
      const newCollected = prev.checkpointsCollected + 1
      const isWon = newCollected >= prev.totalCheckpoints
      return {
        ...prev,
        checkpointsCollected: newCollected,
        isGameWon: isWon,
        isGameActive: !isWon,
      }
    })
  }, [])

  const startGame = () => {
    setIsStarted(true)
    setGameState(prev => ({ ...prev, isGameActive: true }))
  }

  if (!isStarted) {
    return (
      <div className="h-screen bg-gradient-to-b from-gray-900 to-black flex items-center justify-center">
        <div className="text-center text-white">
          <h1 className="text-6xl font-bold mb-4 text-yellow-400">🏃‍♂️ Maze Runner 3D</h1>
          <p className="text-xl mb-2">Navigate the stone corridors</p>
          <p className="text-lg mb-8 text-gray-300">Collect all ⭐ checkpoints as fast as you can!</p>
          <button
            onClick={startGame}
            className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-4 px-8 rounded-lg text-xl transition-colors"
          >
            Start Game
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-black relative">
      <Canvas
        camera={{ position: [1, 1.6, 1], fov: 75 }}
        onCreated={({ gl }) => {
          gl.setClearColor('#1A1A1A')
        }}
      >
        {/* Lighting */}
        <ambientLight intensity={0.3} />
        <directionalLight
          position={[10, 10, 5]}
          intensity={0.8}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <pointLight position={[0, 5, 0]} intensity={0.5} color="#FFD700" />

        {/* Fog for atmosphere */}
        <fog attach="fog" args={['#1A1A1A', 5, 25]} />

        {/* Game Objects */}
        <MazeWalls />
        <Player onCheckpointCollect={handleCheckpointCollect} gameState={gameState} />
      </Canvas>

      <MouseLookControls />
      <GameHUD gameState={gameState} />
    </div>
  )
}