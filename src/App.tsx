import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Wifi, Plus, Trash2, Smartphone, Loader2, Link as LinkIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { io, Socket } from 'socket.io-client';

type PlaygroundObject = {
  id: string;
  color: string;
  shape: 'square' | 'circle';
  yRatio: number; // For lateral moves (0 to 1)
  xRatio: number; // For vertical moves (0 to 1)
  entranceSide?: 'left' | 'right' | 'top' | 'bottom';
  vx?: number; 
  vy?: number;
};

const COLORS = ['bg-blue-500', 'bg-rose-500', 'bg-emerald-500', 'bg-amber-500', 'bg-violet-500'];

// Individual Drag Shape Component
interface DraggableShapeProps {
  key?: string;
  data: PlaygroundObject;
  workspaceRef: React.RefObject<HTMLDivElement | null>;
  onThrow: (obj: PlaygroundObject, side: 'left' | 'right' | 'top' | 'bottom' | 'trash', xRatio: number, yRatio: number, vx: number, vy: number) => void;
}

const DraggableShape = ({ data, workspaceRef, onThrow }: DraggableShapeProps) => {
  const [isPresent, setIsPresent] = useState(true);

  const animConfig = useMemo(() => {
    const width = workspaceRef.current ? workspaceRef.current.clientWidth : window.innerWidth;
    const height = workspaceRef.current ? workspaceRef.current.clientHeight : window.innerHeight;

    if (data.entranceSide) {
      let startX = width / 2;
      let startY = height / 2;
      
      const offset = 120;
      
      // Calculate start position
      if (data.entranceSide === 'right') {
        startX = width + offset;
        startY = data.yRatio * height;
      } else if (data.entranceSide === 'left') {
        startX = -offset;
        startY = data.yRatio * height;
      } else if (data.entranceSide === 'bottom') {
        startY = height + offset;
        startX = data.xRatio * width;
      } else if (data.entranceSide === 'top') {
        startY = -offset;
        startX = data.xRatio * width;
      }

      // PHYSICS REINFORCEMENT: 
      // We must ensure the object enters the viewport regardless of the user's throw strength.
      const rawVx = data.vx || 0;
      const rawVy = data.vy || 0;
      
      // Calculate a guaranteed push vector
      // If the velocity is low, we provide a standard "entry kick"
      const kickForce = 600; 
      let vx = rawVx;
      let vy = rawVy;

      if (data.entranceSide === 'left') vx = Math.max(kickForce, Math.abs(rawVx));
      if (data.entranceSide === 'right') vx = -Math.max(kickForce, Math.abs(rawVx));
      if (data.entranceSide === 'top') vy = Math.max(kickForce, Math.abs(rawVy));
      if (data.entranceSide === 'bottom') vy = -Math.max(kickForce, Math.abs(rawVy));

      // Target depth: How far into the screen it should land
      // We want it to land significantly inside to be fully visible
      const landingDepth = 150; 
      let targetX = startX;
      let targetY = startY;

      if (data.entranceSide === 'left') targetX = landingDepth;
      if (data.entranceSide === 'right') targetX = width - landingDepth - 96;
      if (data.entranceSide === 'top') targetY = landingDepth;
      if (data.entranceSide === 'bottom') targetY = height - landingDepth - 96;

      // Ensure target is within safe bounds
      const finalX = Math.max(80, Math.min(width - 176, targetX));
      const finalY = Math.max(80, Math.min(height - 176, targetY));

      return {
        initial: { x: startX, y: startY, scale: 0.5, opacity: 0 },
        animate: { 
          x: finalX, 
          y: finalY, 
          scale: 1,
          opacity: 1,
          transition: { 
            x: { type: 'spring', velocity: vx, stiffness: 180, damping: 25, mass: 0.5 },
            y: { type: 'spring', velocity: vy, stiffness: 180, damping: 25, mass: 0.5 },
            opacity: { duration: 0.2 },
            scale: { type: 'spring', stiffness: 300, damping: 20 }
          } 
        }
      };
    } else {
      const centerX = (width / 2) - 48;
      const centerY = (height / 2) - 48;
      return {
        initial: { x: centerX, y: centerY, scale: 0, opacity: 0 },
        animate: { x: centerX, y: centerY, scale: 1, opacity: 1, transition: { type: 'spring' } }
      };
    }
  }, [data.id, data.entranceSide, data.vx, data.vy, data.xRatio, data.yRatio]); 

  const handleDragEnd = (event: any, info: any) => {
    const workspace = workspaceRef.current;
    if (!workspace || !isPresent) return;
    
    const bounds = workspace.getBoundingClientRect();
    const x = info.point.x - bounds.left;
    const y = info.point.y - bounds.top;
    
    // The object is 96px wide (w-24). 50% crossing means the center (48px) reached the edge.
    const halfSize = 48; 
    const cornerTrash = 60; 
    
    const isAtLeft = x < halfSize;
    const isAtRight = x > bounds.width - halfSize;
    const isAtTop = y < halfSize;
    const isAtBottom = y > bounds.height - halfSize;

    // Corner detection (Trash)
    const isAtTopLeft = (y < cornerTrash) && (x < cornerTrash);
    const isAtTopRight = (y < cornerTrash) && (x > bounds.width - cornerTrash);
    const isAtBottomLeft = (y > bounds.height - cornerTrash) && (x < cornerTrash);
    const isAtBottomRight = (y > bounds.height - cornerTrash) && (x > bounds.width - cornerTrash);

    if (isAtTopLeft || isAtTopRight || isAtBottomLeft || isAtBottomRight) {
      setIsPresent(false);
      onThrow(data, 'trash', 0, 0, 0, 0);
      return;
    }

    let side: 'left' | 'right' | 'top' | 'bottom' | null = null;
    
    // Velocity check + 50% Position check
    // Even if velocity is 0, if more than 50% is across (center reached edge), it transfers.
    if (isAtLeft) side = 'left';
    else if (isAtRight) side = 'right';
    else if (isAtTop) side = 'top';
    else if (isAtBottom) side = 'bottom';

    if (side) {
       setIsPresent(false); 
       const xRatio = Math.max(0, Math.min(1, x / bounds.width));
       const yRatio = Math.max(0, Math.min(1, y / bounds.height));
       
       // Force a minimum velocity if the user is dragging slowly so it "pops" in on the other side
       const minVelocity = 400;
       let vx = info.velocity.x;
       let vy = info.velocity.y;

       if (side === 'left' && vx > -minVelocity) vx = -minVelocity;
       if (side === 'right' && vx < minVelocity) vx = minVelocity;
       if (side === 'top' && vy > -minVelocity) vy = -minVelocity;
       if (side === 'bottom' && vy < minVelocity) vy = minVelocity;

       onThrow(data, side, xRatio, yRatio, vx, vy);
    }
  };

  if (!isPresent) return null;

  return (
    <motion.div
      drag
      dragMomentum={true}
      onDragEnd={handleDragEnd}
      initial={animConfig.initial}
      animate={animConfig.animate}
      whileHover={{ scale: 1.05 }}
      whileDrag={{ scale: 1.1, zIndex: 50, cursor: 'grabbing' }}
      className={`absolute w-24 h-24 ${data.color} shadow-2xl cursor-grab flex items-center justify-center
        ${data.shape === 'circle' ? 'rounded-full' : 'rounded-3xl'} border-4 border-white/30`}
      style={{ touchAction: 'none' }} 
    />
  );
};

export default function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  
  const [roomCode, setRoomCode] = useState('');
  const [activeRoom, setActiveRoom] = useState('');
  const [peersCount, setPeersCount] = useState(1);
  
  const [objects, setObjects] = useState<PlaygroundObject[]>([]);
  const workspaceRef = useRef<HTMLDivElement>(null);

  const socketRef = useRef<Socket | null>(null);
  const activeRoomRef = useRef<string>('');

  useEffect(() => {
    activeRoomRef.current = activeRoom;
  }, [activeRoom]);

  useEffect(() => {
    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, []);

  const connectToRoom = (codeToJoin?: string) => {
    const finalCode = (codeToJoin || roomCode || Math.random().toString(36).substring(2, 8)).toUpperCase();
    
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    setIsConnecting(true);
    setRoomCode(finalCode);

    const newSocket = io({
      reconnectionAttempts: 10,
      timeout: 10000,
    });

    socketRef.current = newSocket;

    newSocket.on('connect', () => {
      setIsConnected(true);
      setIsConnecting(false);
      setActiveRoom(finalCode);
      newSocket.emit('join_room', finalCode);
    });

    newSocket.on('connect_error', () => {
      setIsConnecting(false);
      alert("Erro de conexão. Tente novamente.");
    });

    newSocket.on('room_status', (data: { roomCode: string, size: number }) => {
       if (data.roomCode === activeRoomRef.current) {
         setPeersCount(data.size);
       }
    });

    newSocket.on('receive_message', (data: { payload: any, sender: string }) => {
      if (data.payload?.type === 'TRANSFER_OBJECT') {
        const obj = data.payload.object as PlaygroundObject;
        
        let enterSide: PlaygroundObject['entranceSide'] = 'left';
        if (obj.entranceSide === 'right') enterSide = 'left';
        else if (obj.entranceSide === 'left') enterSide = 'right';
        else if (obj.entranceSide === 'top') enterSide = 'bottom';
        else if (obj.entranceSide === 'bottom') enterSide = 'top';

        setObjects(prev => [...prev.filter(o => o.id !== obj.id), {
           ...obj,
           entranceSide: enterSide
        }]);
      }
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
      setActiveRoom('');
      setPeersCount(1);
      setObjects([]);
    });

    setSocket(newSocket);
  };

  const disconnectDevice = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setSocket(null);
    setIsConnected(false);
    setActiveRoom('');
    setPeersCount(1);
    setObjects([]);
  };

  const spawnObject = () => {
    const newObj: PlaygroundObject = {
      id: Math.random().toString(36).substring(2, 9),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      shape: Math.random() > 0.5 ? 'square' : 'circle',
      yRatio: 0.5,
      xRatio: 0.5
    };
    setObjects(prev => [...prev, newObj]);
  };

  const handleThrow = (objToTransfer: PlaygroundObject, side: 'left' | 'right' | 'top' | 'bottom' | 'trash', xRatio: number, yRatio: number, vx: number, vy: number) => {
    if (side === 'trash') {
      setObjects(prev => prev.filter(obj => obj.id !== objToTransfer.id));
      return;
    }

    const currentSocket = socketRef.current;
    const currentRoom = activeRoomRef.current;

    if (!currentSocket || !isConnected || !currentRoom) return;

    currentSocket.emit('send_message', {
       roomCode: currentRoom,
       payload: {
         type: 'TRANSFER_OBJECT',
         object: {
           ...objToTransfer,
           xRatio,
           yRatio,
           entranceSide: side,
           vx,
           vy
         }
       },
       sender: currentSocket.id
    });

    setObjects(prev => prev.filter(obj => obj.id !== objToTransfer.id));
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans text-slate-800 flex flex-col overflow-hidden select-none">
      {/* Header Strategy: Minimalist & Integrated */}
      <header className="h-16 sm:h-20 border-b border-slate-200 bg-white/80 backdrop-blur-md px-6 sm:px-10 flex items-center justify-between shrink-0 z-30 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200 rotate-3 transition-transform hover:rotate-0">
            {isConnected ? <Wifi size={22} className="text-white" /> : <Smartphone size={22} className="text-white" />}
          </div>
          <div className="flex flex-col">
            <span className="font-black text-xl md:text-2xl tracking-tighter text-slate-900 leading-none">
              NEXUS<span className="text-blue-600">PLAY</span>
            </span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              {isConnected ? 'Portal Ativo' : 'Offline'}
            </span>
          </div>
        </div>

        {isConnected && (
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end mr-4">
               <div className="flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                 <span className="text-xs font-black text-slate-900 tracking-tight uppercase">SALA: {activeRoom}</span>
               </div>
               <span className="text-[10px] font-bold text-blue-500 uppercase tracking-tighter">
                  {peersCount === 1 ? 'Aguardando Link...' : `${peersCount} Conectados`}
               </span>
            </div>
            
            <button
              onClick={disconnectDevice}
              className="px-5 py-2.5 bg-slate-100 text-slate-900 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 border border-slate-200 transition-all shadow-sm active:scale-95"
            >
              Sair
            </button>
          </div>
        )}
      </header>

      {/* Main Container with Status for Mobile */}
      {isConnected && (
        <div className="sm:hidden w-full bg-white border-b border-slate-100 px-6 py-2 flex justify-between items-center z-20 shadow-sm">
           <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
             <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
             <span className="text-[10px] font-black text-slate-700 tracking-wider">#{activeRoom}</span>
           </div>
           <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest">
              {peersCount === 1 ? 'Link pendente' : `${peersCount} ONLINE`}
           </span>
        </div>
      )}

      {/* The Workspace */}
      <div 
        ref={workspaceRef}
        className="flex-1 relative overflow-hidden bg-[#f0f4f8]"
        style={{
          backgroundImage: `
            radial-gradient(circle at 2px 2px, #cbd5e1 1px, transparent 0),
            radial-gradient(circle at 20px 20px, #e2e8f0 1.5px, transparent 0)
          `,
          backgroundSize: '40px 40px, 400px 400px'
        }}
      >
        {/* Directional Portal Indicators - Refined */}
        {isConnected && (
          <div className="absolute inset-0 pointer-events-none z-0">
            {/* Horizontal Portals */}
            <div className="absolute left-0 top-[10%] bottom-[10%] w-1.5 bg-gradient-to-b from-transparent via-blue-500/40 to-transparent rounded-r-full shadow-[2px_0_10px_rgba(59,130,246,0.3)]" />
            <div className="absolute right-0 top-[10%] bottom-[10%] w-1.5 bg-gradient-to-b from-transparent via-blue-500/40 to-transparent rounded-l-full shadow-[-2px_0_10px_rgba(59,130,246,0.3)]" />
            
            {/* Vertical Portals */}
            <div className="absolute top-0 left-[10%] right-[10%] h-1.5 bg-gradient-to-r from-transparent via-blue-500/40 to-transparent rounded-b-full shadow-[0_2px_10px_rgba(59,130,246,0.3)]" />
            <div className="absolute bottom-0 left-[10%] right-[10%] h-1.5 bg-gradient-to-r from-transparent via-blue-500/40 to-transparent rounded-t-full shadow-[0_-2px_10px_rgba(59,130,246,0.3)]" />
            
            {/* Trash Labels in Corners */}
            <div className="absolute top-4 left-4 p-2 bg-rose-500/5 rounded-xl border border-rose-500/10 text-rose-500/40 opacity-50 flex items-center gap-2">
              <Trash2 size={12} /><span className="text-[8px] font-black uppercase">Excluir</span>
            </div>
            <div className="absolute top-4 right-4 p-2 bg-rose-500/5 rounded-xl border border-rose-500/10 text-rose-500/40 opacity-50 flex items-center gap-2">
              <span className="text-[8px] font-black uppercase">Excluir</span><Trash2 size={12} />
            </div>
            <div className="absolute bottom-4 left-4 p-2 bg-rose-500/5 rounded-xl border border-rose-500/10 text-rose-500/40 opacity-50 flex items-center gap-2">
              <Trash2 size={12} /><span className="text-[8px] font-black uppercase">Excluir</span>
            </div>
            <div className="absolute bottom-4 right-4 p-2 bg-rose-500/5 rounded-xl border border-rose-500/10 text-rose-500/40 opacity-50 flex items-center gap-2">
              <span className="text-[8px] font-black uppercase">Excluir</span><Trash2 size={12} />
            </div>
          </div>
        )}

        {/* Login UI */}
        {!isConnected && (
            <div className="absolute inset-0 z-40 flex items-center justify-center p-6 bg-slate-900/5 backdrop-blur-[2px]">
                <div className="w-full max-w-[380px] bg-white p-10 rounded-[40px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.15)] border border-slate-100 flex flex-col items-center text-center">
                    <div className="w-24 h-24 bg-blue-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-blue-200 mb-8 text-white -rotate-6">
                        <Wifi size={48} strokeWidth={2.5} />
                    </div>
                    
                    <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter mb-3 leading-none italic">
                      Portal <span className="text-blue-600">Nex</span>
                    </h2>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-[0.2em] mb-10 opacity-70">Sincronia Instantânea</p>
                    
                    <div className="w-full space-y-5">
                        <div className="relative">
                          <input
                              type="text"
                              placeholder="CÓDIGO"
                              value={roomCode}
                              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                              className="w-full bg-slate-50 border-2 border-slate-100 text-slate-900 pl-8 pr-8 py-5 rounded-[24px] font-black text-center text-2xl uppercase tracking-[0.3em] focus:outline-none focus:border-blue-500 focus:bg-white transition-all shadow-inner"
                              maxLength={6}
                          />
                        </div>
                        <button
                            onClick={() => connectToRoom(roomCode)}
                            disabled={isConnecting}
                            className="w-full py-5 bg-slate-900 text-white rounded-[24px] font-black text-sm uppercase tracking-widest hover:bg-blue-600 disabled:opacity-70 transition-all shadow-xl active:scale-[0.98] flex items-center justify-center gap-3"
                        >
                            {isConnecting ? <Loader2 size={18} className="animate-spin" /> : <LinkIcon size={18} />}
                            {isConnecting ? 'CONECTANDO...' : (roomCode ? 'ENTRAR NA SALA' : 'CRIAR NOVA SALA')}
                        </button>
                    </div>
                    
                    <div className="mt-10 pt-8 border-t border-slate-50 w-full">
                       <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest leading-relaxed">
                          Arremesse objetos pelos lados <br/> para o outro dispositivo
                       </p>
                    </div>
                </div>
            </div>
        )}
        
        {/* Workspace Hints */}
        {isConnected && objects.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center opacity-20 pointer-events-none p-12 text-center">
                <div className="w-20 h-20 border-4 border-dashed border-slate-300 rounded-full animate-[spin_10s_linear_infinite] mb-8" />
                <h1 className="text-xl md:text-3xl font-black tracking-tighter text-slate-900 uppercase italic">
                   Laboratório NEXUS<br/>
                   <span className="text-xs font-bold tracking-[0.4em] text-blue-600 block mt-2 opacity-60">Pronto para Transferência</span>
                </h1>
            </div>
        )}

        {objects.map(obj => (
           <DraggableShape 
              key={obj.id} 
              data={obj} 
              workspaceRef={workspaceRef}
              onThrow={handleThrow}
           />
        ))}

        {/* Action Controls */}
        {isConnected && (
           <div className="absolute bottom-6 sm:bottom-10 right-6 sm:right-10 flex flex-col gap-4 z-20">
              <motion.button
                 whileHover={{ scale: 1.1, rotate: 90 }}
                 whileTap={{ scale: 0.9 }}
                 onClick={spawnObject}
                 className="w-16 h-16 sm:w-20 sm:h-20 bg-blue-600 rounded-[28px] text-white shadow-[0_20px_40px_rgba(37,99,235,0.4)] flex items-center justify-center hover:bg-blue-700 transition-all border-4 border-blue-500/30"
              >
                 <Plus size={36} strokeWidth={3} />
              </motion.button>
           </div>
        )}
      </div>
    </div>
  );
}

