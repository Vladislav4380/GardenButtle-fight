// Generated from pages/figures/battle-engine.ts by tools/build-figure-physics.cjs.
const FigurePhysics = (() => {
const distance = (a, b) => Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y);
const currentSpeed = (hero) => Math.hypot(hero.velocity.x, hero.velocity.y);
const momentum = (hero) => hero.mass * hero.moveSpeed;
function keepInsideField(h, s) {
    h.position.x = Math.max(h.radius, Math.min(s.width - h.radius, h.position.x));
    h.position.y = Math.max(h.radius, Math.min(s.height - h.radius, h.position.y));
}
function resolveOverlaps(s, dt = 0) {
    const heroes = s.heroes.filter((h) => h.hp > 0);
    const padding = 2;
    const contactMargin = dt > 0 ? 1 : 0;
    const parents = heroes.map((_, index) => index);
    const find = (index) => {
        while (parents[index] !== index) {
            parents[index] = parents[parents[index]];
            index = parents[index];
        }
        return index;
    };
    const union = (a, b) => {
        const rootA = find(a);
        const rootB = find(b);
        if (rootA !== rootB)
            parents[rootB] = rootA;
    };
    for (let i = 0; i < heroes.length; i++) {
        for (let j = i + 1; j < heroes.length; j++) {
            const contactDistance = heroes[i].radius + heroes[j].radius + padding + contactMargin;
            if (distance(heroes[i], heroes[j]) <= contactDistance)
                union(i, j);
        }
    }
    const groups = new Map();
    for (let index = 0; index < heroes.length; index++) {
        const root = find(index);
        const group = groups.get(root) ?? [];
        group.push(heroes[index]);
        groups.set(root, group);
    }
    if (dt > 0) {
        for (const group of groups.values()) {
            const blue = group.filter((hero) => hero.team === 'blue');
            const red = group.filter((hero) => hero.team === 'red');
            if (!blue.length || !red.length)
                continue;
            let pushBlueX = 0;
            let pushBlueY = 0;
            let maximumOverlap = 0;
            let enemyContacts = 0;
            for (const blueHero of blue) {
                for (const redHero of red) {
                    let dx = blueHero.position.x - redHero.position.x;
                    let dy = blueHero.position.y - redHero.position.y;
                    const centerDistance = Math.hypot(dx, dy);
                    const minimumDistance = blueHero.radius + redHero.radius + padding;
                    if (centerDistance > minimumDistance + contactMargin)
                        continue;
                    if (centerDistance < 0.001) {
                        dx = blueHero.team === 'blue' ? 0 : 1;
                        dy = s.orientation === 'portrait' ? 1 : -1;
                    }
                    const length = Math.max(1, Math.hypot(dx, dy));
                    pushBlueX += dx / length;
                    pushBlueY += dy / length;
                    maximumOverlap = Math.max(maximumOverlap, minimumDistance - centerDistance);
                    enemyContacts++;
                }
            }
            if (!enemyContacts)
                continue;
            let normalLength = Math.hypot(pushBlueX, pushBlueY);
            if (normalLength < 0.001) {
                const blueCenter = blue.reduce((point, hero) => ({ x: point.x + hero.position.x, y: point.y + hero.position.y }), { x: 0, y: 0 });
                const redCenter = red.reduce((point, hero) => ({ x: point.x + hero.position.x, y: point.y + hero.position.y }), { x: 0, y: 0 });
                pushBlueX = blueCenter.x / blue.length - redCenter.x / red.length;
                pushBlueY = blueCenter.y / blue.length - redCenter.y / red.length;
                normalLength = Math.max(1, Math.hypot(pushBlueX, pushBlueY));
            }
            pushBlueX /= normalLength;
            pushBlueY /= normalLength;
            const blueMomentum = blue.reduce((sum, hero) => sum + momentum(hero), 0);
            const redMomentum = red.reduce((sum, hero) => sum + momentum(hero), 0);
            const difference = Math.abs(blueMomentum - redMomentum);
            const relativeDifference = difference / Math.max(blueMomentum, redMomentum, 1);
            const pressure = relativeDifference * 90 * (dt / 1000);
            const displacement = Math.max(0, maximumOverlap) + pressure;
            const moveGroup = (units, dx, dy, amount) => {
                for (const hero of units) {
                    hero.position.x += dx * amount;
                    hero.position.y += dy * amount;
                    keepInsideField(hero, s);
                }
            };
            if (blueMomentum < redMomentum) {
                moveGroup(blue, pushBlueX, pushBlueY, displacement);
            }
            else if (redMomentum < blueMomentum) {
                moveGroup(red, -pushBlueX, -pushBlueY, displacement);
            }
            else if (maximumOverlap > 0) {
                moveGroup(blue, pushBlueX, pushBlueY, maximumOverlap / 2);
                moveGroup(red, -pushBlueX, -pushBlueY, maximumOverlap / 2);
            }
        }
    }
    // A second, neutral solver removes remaining penetrations. It never compares
    // individual momenta, so it cannot force one member through its supporting group.
    for (let pass = 0; pass < 4; pass++) {
        for (let i = 0; i < heroes.length; i++) {
            for (let j = i + 1; j < heroes.length; j++) {
                const a = heroes[i];
                const b = heroes[j];
                let dx = b.position.x - a.position.x;
                let dy = b.position.y - a.position.y;
                let centerDistance = Math.hypot(dx, dy);
                const minimumDistance = a.radius + b.radius + padding;
                if (centerDistance >= minimumDistance)
                    continue;
                if (centerDistance < 0.001) {
                    const angle = (((i + 1) * 37 + (j + 1) * 71) % 360) * (Math.PI / 180);
                    dx = Math.cos(angle);
                    dy = Math.sin(angle);
                    centerDistance = 1;
                }
                const nx = dx / centerDistance;
                const ny = dy / centerDistance;
                const push = (minimumDistance - centerDistance) / 2;
                a.position.x -= nx * push;
                a.position.y -= ny * push;
                b.position.x += nx * push;
                b.position.y += ny * push;
                keepInsideField(a, s);
                keepInsideField(b, s);
            }
        }
    }
}

return { resolveOverlaps };
})();
