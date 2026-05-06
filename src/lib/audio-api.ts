/**
 * Audio API utility for handling real-time analysis
 */

export class AudioAnalyzer {
  private context: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaElementAudioSourceNode | null = null;
  private dataArray: Uint8Array | null = null;

  constructor() {
    // Context is initialized on first user interaction to comply with browser policies
  }

  public init(audioElement: HTMLAudioElement) {
    if (!this.context) {
      this.context = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = 256; // High frequency resolution
      this.source = this.context.createMediaElementSource(audioElement);
      this.source.connect(this.analyser);
      this.analyser.connect(this.context.destination);
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    }
  }

  public getData() {
    if (this.analyser && this.dataArray) {
      this.analyser.getByteFrequencyData(this.dataArray);
      return this.dataArray;
    }
    return null;
  }

  public getTimeDomainData() {
    if (this.analyser && this.dataArray) {
      this.analyser.getByteTimeDomainData(this.dataArray);
      return this.dataArray;
    }
    return null;
  }

  public getAnalysis() {
    if (!this.analyser || !this.dataArray) return null;
    
    this.analyser.getByteFrequencyData(this.dataArray);
    
    // Calculate simple spectral centroid for timbre (brightness)
    let totalAmplitude = 0;
    let weightedFrequencySum = 0;
    let maxAmp = 0;
    let peakBin = 0;

    for (let i = 0; i < this.dataArray.length; i++) {
      const amp = this.dataArray[i];
      totalAmplitude += amp;
      weightedFrequencySum += amp * i;
      
      if (amp > maxAmp) {
        maxAmp = amp;
        peakBin = i;
      }
    }

    const centroid = totalAmplitude > 0 ? weightedFrequencySum / totalAmplitude : 0;
    const normalizedCentroid = centroid / (this.dataArray.length / 2);
    
    return {
      data: this.dataArray,
      pitch: peakBin / this.dataArray.length, // Rough pitch estimation
      timbre: normalizedCentroid, // Rough brightness estimation
      energy: totalAmplitude / (this.dataArray.length * 255)
    };
  }

  public close() {
    this.context?.close();
  }
}
