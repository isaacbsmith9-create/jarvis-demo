import Phaser from 'phaser';
import { useEffect, useRef, useState } from 'react';
import { OfficeScene, type InteriorBridge } from './scenes/OfficeScene';

type Data = ReturnType<InteriorBridge['getData']>;

/** Mounts an interior scene for one company. */
export function PhaserInterior({ data, onSelectEmployee }: { data: Data; onSelectEmployee: (id: string) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ name: string; title: string; x: number; y: number } | null>(null);
  const dataRef = useRef(data);
  dataRef.current = data;
  const selRef = useRef(onSelectEmployee);
  selRef.current = onSelectEmployee;
  const staffKey = data ? data.staff.map((s) => s.id).join(',') + (data.owner ?? '') : '';

  useEffect(() => {
    if (!host.current) return;
    const bridge: InteriorBridge = {
      getData: () => dataRef.current,
      onSelectEmployee: (id) => selRef.current(id),
      onHover: setHover,
    };
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: host.current,
      width: host.current.clientWidth || 900,
      height: host.current.clientHeight || 560,
      backgroundColor: '#0c0c0f',
      banner: false,
      audio: { noAudio: true },
      render: { antialias: true, powerPreference: 'low-power' },
    });
    game.scene.add('office', OfficeScene, true, { bridge });
    return () => game.destroy(true);
  }, [staffKey]);

  return (
    <div className="interior" ref={host}>
      {hover && (
        <div className="hover-tip" style={{ left: hover.x + 14, top: hover.y - 10 }}>
          <div>{hover.name}</div>
          <div className="dim tiny">{hover.title}</div>
        </div>
      )}
    </div>
  );
}
