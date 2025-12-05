'use client';

import { useState } from 'react';

export default function DayGeneratorSandbox() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dayData, setDayData] = useState<any>(null);
  const [rawJson, setRawJson] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setDayData(null);
    setRawJson(null);

    try {
      const response = await fetch('/api/dev/generate-day', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (data.success) {
        setDayData(data.day);
        setRawJson(data.rawJson);
      } else {
        setError(data.error || 'Failed to generate day');
        if (data.details) {
          setError(`${data.error}: ${data.details}`);
        }
        if (data.rawResponse) {
          setRawJson(data.rawResponse);
        }
      }
    } catch (err: any) {
      console.error('Generate error:', err);
      setError(err.message || 'Failed to generate day');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '2rem', fontFamily: 'monospace' }}>
      <h1>Day Generator Sandbox</h1>
      <p>Isolated test module for AI-generated training day JSON</p>

      <div style={{ marginTop: '2rem', marginBottom: '2rem' }}>
        <button
          onClick={handleGenerate}
          disabled={loading}
          style={{
            padding: '0.75rem 1.5rem',
            fontSize: '1rem',
            backgroundColor: loading ? '#ccc' : '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Generating...' : 'Generate Test Day'}
        </button>
      </div>

      {error && (
        <div
          style={{
            padding: '1rem',
            backgroundColor: '#fee',
            border: '1px solid #fcc',
            borderRadius: '4px',
            marginBottom: '1rem',
            color: '#c00',
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}

      {dayData && (
        <div style={{ marginTop: '2rem' }}>
          <h2>Generated Day (Parsed)</h2>
          <pre
            style={{
              padding: '1rem',
              backgroundColor: '#f5f5f5',
              border: '1px solid #ddd',
              borderRadius: '4px',
              overflow: 'auto',
              fontSize: '0.9rem',
            }}
          >
            {JSON.stringify(dayData, null, 2)}
          </pre>
        </div>
      )}

      {rawJson && (
        <div style={{ marginTop: '2rem' }}>
          <h2>Raw JSON from GPT</h2>
          <pre
            style={{
              padding: '1rem',
              backgroundColor: '#f0f0f0',
              border: '1px solid #ddd',
              borderRadius: '4px',
              overflow: 'auto',
              fontSize: '0.9rem',
            }}
          >
            {rawJson}
          </pre>
        </div>
      )}

      {dayData && (
        <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#e8f5e9', borderRadius: '4px' }}>
          <h3>Validation Summary</h3>
          <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
            <li>Date: {dayData.date}</li>
            <li>Day of Week: {dayData.dayOfWeek}</li>
            <li>Total Miles: {dayData.totalMiles}</li>
            <li>Workout Type: {dayData.workoutType}</li>
            <li>Number of Laps: {dayData.laps?.length || 0}</li>
            <li>
              Calculated Total: {dayData.laps?.reduce((sum: number, lap: any) => sum + lap.distanceMiles, 0).toFixed(2) || '0.00'}
            </li>
            <li>
              Match: {Math.abs((dayData.laps?.reduce((sum: number, lap: any) => sum + lap.distanceMiles, 0) || 0) - dayData.totalMiles) < 0.01 ? '✅' : '❌'}
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}

