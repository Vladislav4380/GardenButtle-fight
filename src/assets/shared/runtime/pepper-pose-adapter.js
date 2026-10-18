const response=await fetch('/assets/characters/pepper/manifest.json');if(!response.ok)throw Error('Missing pepper manifest');const profile=await response.json();
const M={idle:[518.6,1299],cast:[522.4,1367],walkA:[511.5,1291],walkB:[517.8,1310],bIdle:[529.1,1261],bCast:[543.4,1347],bWalkA:[529,1345],bWalkB:[529.7,1381]};
function key(k){return k.startsWith('back')?'b'+k.slice(4):k}
export function poseCanvas(image,k){const m=M[key(k)],canvas=document.createElement('canvas');canvas.width=1024;canvas.height=1536;const g=canvas.getContext('2d'),z=1200/profile.visualHeight;g.drawImage(image,m[0]-profile.anchor.x*z,m[1]-profile.anchor.y*z,profile.canvas.width*z,profile.canvas.height*z);return canvas}
export function poseSocket(k){const m=M[key(k)],p=profile.sockets[key(k).startsWith('b')?'back':'front'].attack,z=1200/profile.visualHeight;return{x:m[0]+(p[0]-profile.anchor.x)*z,y:m[1]+(p[1]-profile.anchor.y)*z}}

