import {
    ButtonItem,
    Focusable,
    PanelSection,
    PanelSectionRow,
    ToggleField
} from "@decky/ui";
import { toaster } from "@decky/api";
import { FaPlay, FaPause, FaFlag, FaUndo, FaCopy } from "react-icons/fa";
import { useStopwatch } from "../hooks/useStopwatch";
import { formatStopwatch, formatLapSplit } from "../utils/time";
import type { StopwatchLap } from "../types";
import { useEffect, useRef } from "react";

export function StopwatchPanel() {
    const {
        status,
        elapsed,
        currentLapElapsed,
        laps,
        preventSleep,
        loading,
        autoReset,
        lapLimitReached,
        start,
        pause,
        reset,
        lap,
        copyLaps,
        setPreventSleep
    } = useStopwatch();

    const prevLapLimitReached = useRef(false);
    const prevAutoReset = useRef(false);

    useEffect(() => {
        if (lapLimitReached && !prevLapLimitReached.current) {
            toaster.toast({
                title: "Stopwatch",
                body: "Max laps reached. Oldest laps will be overwritten."
            });
        }
        prevLapLimitReached.current = lapLimitReached;
    }, [lapLimitReached]);

    useEffect(() => {
        if (autoReset && !prevAutoReset.current) {
            toaster.toast({
                title: "Stopwatch",
                body: "Max runtime (24h) reached. Stopwatch was reset."
            });
        }
        prevAutoReset.current = autoReset;
    }, [autoReset]);

    const isRunning = status === 'running';
    const isPaused = status === 'paused';
    const isIdle = status === 'idle';
    const canReset = isPaused || isIdle;
    const canLap = isRunning;
    const hasLaps = laps.length > 0;

    const handleCopyLaps = async () => {
        const text = await copyLaps();
        if (text && navigator.clipboard) {
            try {
                await navigator.clipboard.writeText(text);
            } catch (e) {
                console.error('Failed to copy to clipboard:', e);
            }
        }
    };

    const fastestSplitMs = hasLaps ? Math.min(...laps.map(l => l.split_ms)) : 0;
    const slowestSplitMs = hasLaps && laps.length > 1 ? Math.max(...laps.map(l => l.split_ms)) : 0;

    const getLapColor = (lap: StopwatchLap): string => {
        if (laps.length < 2) return '#ffffff';
        if (lap.split_ms === fastestSplitMs) return '#44cc66';
        if (lap.split_ms === slowestSplitMs) return '#cc4444';
        return '#ffffff';
    };

    if (loading) {
        return (
            <PanelSection title="Stopwatch">
                <PanelSectionRow>
                    <div style={{ textAlign: 'center', padding: 20, color: '#888' }}>
                        Loading...
                    </div>
                </PanelSectionRow>
            </PanelSection>
        );
    }

    return (
        <div>
            <PanelSection title="Stopwatch">
                {/* Main Display */}
                <PanelSectionRow>
                    <div style={{ textAlign: 'center', padding: '16px 0' }}>
                        {/* Primary Time Display */}
                        <div style={{
                            fontSize: 42,
                            fontWeight: 'bold',
                            fontFamily: 'monospace',
                            color: isRunning ? '#ffffff' : (isPaused ? '#ffaa44' : '#666666'),
                            letterSpacing: 1
                        }}>
                            {formatStopwatch(elapsed)}
                        </div>

                        {/* Current Lap Timer (when laps exist) */}
                        {hasLaps && (
                            <div style={{
                                fontSize: 24,
                                fontFamily: 'monospace',
                                color: '#888888',
                                marginTop: 8
                            }}>
                                Lap {laps.length + 1}: {formatStopwatch(currentLapElapsed)}
                            </div>
                        )}

                        {/* Status Indicator */}
                        <div style={{
                            fontSize: 12,
                            color: isRunning ? '#44cc66' : (isPaused ? '#ffaa44' : '#666666'),
                            marginTop: 12,
                            textTransform: 'uppercase',
                            letterSpacing: 1
                        }}>
                            {isRunning ? '● Running' : (isPaused ? '❚❚ Paused' : '○ Stopped')}
                        </div>
                    </div>
                </PanelSectionRow>

                {/* Control Buttons */}
                <PanelSectionRow>
                    <Focusable
                        flow-children="row"
                        style={{
                            display: 'flex',
                            gap: 8,
                            justifyContent: 'center'
                        }}
                    >
                        {/* Left Button: Lap / Reset */}
                        <Focusable
                            onActivate={canLap ? lap : (canReset && (isPaused || hasLaps) ? reset : undefined)}
                            style={{
                                flex: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 8,
                                padding: '12px 16px',
                                backgroundColor: canLap ? '#ffffff22' : (canReset && (isPaused || hasLaps) ? '#ff444422' : '#ffffff11'),
                                borderRadius: 8,
                                border: '2px solid transparent',
                                cursor: (canLap || (canReset && (isPaused || hasLaps))) ? 'pointer' : 'default',
                                opacity: (canLap || (canReset && (isPaused || hasLaps))) ? 1 : 0.4,
                                transition: 'all 0.1s ease-in-out'
                            }}
                            onFocus={(e: any) => {
                                if (canLap || (canReset && (isPaused || hasLaps))) {
                                    e.target.style.borderColor = 'white';
                                    e.target.style.backgroundColor = canLap ? '#4488aa' : '#aa4444';
                                }
                            }}
                            onBlur={(e: any) => {
                                e.target.style.borderColor = 'transparent';
                                e.target.style.backgroundColor = canLap ? '#ffffff22' : (canReset && (isPaused || hasLaps) ? '#ff444422' : '#ffffff11');
                            }}
                        >
                            {canLap ? <FaFlag size={14} /> : <FaUndo size={14} />}
                            <span style={{ fontSize: 14 }}>
                                {canLap ? 'Lap' : 'Reset'}
                            </span>
                        </Focusable>

                        {/* Right Button: Start / Stop */}
                        <Focusable
                            onActivate={isRunning ? pause : start}
                            style={{
                                flex: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 8,
                                padding: '12px 16px',
                                backgroundColor: isRunning ? '#ff444444' : '#44cc6644',
                                borderRadius: 8,
                                border: '2px solid transparent',
                                cursor: 'pointer',
                                transition: 'all 0.1s ease-in-out'
                            }}
                            onFocus={(e: any) => {
                                e.target.style.borderColor = 'white';
                                e.target.style.backgroundColor = isRunning ? '#cc4444' : '#44aa44';
                            }}
                            onBlur={(e: any) => {
                                e.target.style.borderColor = 'transparent';
                                e.target.style.backgroundColor = isRunning ? '#ff444444' : '#44cc6644';
                            }}
                        >
                            {isRunning ? <FaPause size={14} /> : <FaPlay size={14} />}
                            <span style={{ fontSize: 14 }}>
                                {isRunning ? 'Stop' : (isPaused ? 'Resume' : 'Start')}
                            </span>
                        </Focusable>
                    </Focusable>
                </PanelSectionRow>
                {/* Prevent Sleep Toggle */}
                <PanelSectionRow>
                    <ToggleField
                        icon={<span style={{ fontSize: 14 }}>🛡️</span>}
                        label="Prevent Sleep"
                        description="Keep device awake while stopwatch is running"
                        checked={preventSleep}
                        onChange={setPreventSleep}
                    />
                </PanelSectionRow>
            </PanelSection>

            {/* Lap List */}
            {hasLaps && (
                <PanelSection title={`Laps (${laps.length})`}>
                    {/* Copy Button */}
                    <PanelSectionRow>
                        <ButtonItem
                            layout="below"
                            onClick={handleCopyLaps}
                        >
                            <FaCopy size={12} style={{ marginRight: 8 }} />
                            Copy Laps to Clipboard
                        </ButtonItem>
                    </PanelSectionRow>

                    {/* Lap Entries (reverse order - latest first) */}
                    <PanelSectionRow>
                        <Focusable
                            style={{
                                maxHeight: 200,
                                overflowY: 'auto',
                                width: '100%'
                            }}
                        >
                            {[...laps].reverse().map((lapItem, idx) => {
                                const lapColor = getLapColor(lapItem);
                                const isFastest = laps.length > 1 && lapItem.split_ms === fastestSplitMs;
                                const isSlowest = laps.length > 1 && lapItem.split_ms === slowestSplitMs;

                                return (
                                    <Focusable
                                        key={laps.length - idx}
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            padding: '8px 12px',
                                            backgroundColor: idx % 2 === 0 ? '#ffffff08' : 'transparent',
                                            borderRadius: 4,
                                            border: '2px solid transparent',
                                            transition: 'all 0.1s ease-in-out'
                                        }}
                                        onFocus={(e: any) => {
                                            e.target.style.borderColor = '#4488aa';
                                            e.target.style.backgroundColor = '#ffffff15';
                                        }}
                                        onBlur={(e: any) => {
                                            e.target.style.borderColor = 'transparent';
                                            e.target.style.backgroundColor = idx % 2 === 0 ? '#ffffff08' : 'transparent';
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{ 
                                                color: lapColor, 
                                                fontWeight: (isFastest || isSlowest) ? 'bold' : 'normal',
                                                minWidth: 50
                                            }}>
                                                {lapItem.label}
                                            </span>
                                            {isFastest && <span style={{ fontSize: 10, color: '#44cc66' }}>FAST</span>}
                                            {isSlowest && <span style={{ fontSize: 10, color: '#cc4444' }}>SLOW</span>}
                                        </div>
                                        <div style={{ 
                                            fontFamily: 'monospace', 
                                            display: 'flex',
                                            gap: 16,
                                            alignItems: 'center'
                                        }}>
                                            <span style={{ color: lapColor, fontSize: 13 }}>
                                                +{formatLapSplit(lapItem.split_ms)}
                                            </span>
                                            <span style={{ color: '#888888', fontSize: 12 }}>
                                                {formatStopwatch(lapItem.absolute_ms)}
                                            </span>
                                        </div>
                                    </Focusable>
                                );
                            })}
                        </Focusable>
                    </PanelSectionRow>
                </PanelSection>
            )}
        </div>
    );
}
