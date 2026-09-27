export function createPerformancePolicy() {
  const coarse=matchMedia('(pointer: coarse)').matches;
  const constrained=(navigator.deviceMemory||8)<=4||(navigator.hardwareConcurrency||8)<=4;
  const count=coarse ? (constrained?150:210) : (constrained?230:340);
  const maxRatio=Math.min(devicePixelRatio||1,coarse?1.7:2);
  let ratio=maxRatio,elapsed=0,frames=0,cooldown=4;
  return {count,get ratio(){return ratio;},sample(dt,onChange){
    elapsed+=dt;frames++;
    if(elapsed<2) return;
    const mean=elapsed/frames;cooldown-=elapsed;
    if(cooldown<=0) {
      const next=mean>.021?Math.max(.85,ratio*.84):mean<.014?Math.min(maxRatio,ratio*1.08):ratio;
      if(Math.abs(next-ratio)>.025) {ratio=next;onChange(ratio);cooldown=4;}
    }
    elapsed=0;frames=0;
  }};
}
