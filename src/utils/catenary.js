/**
 * Solves the catenary equation for the given constraints.
 * 
 * A catenary is defined by y = a * cosh((x - offset) / a) + C
 * We need to find 'a' (the catenary parameter) such that the curve length between x1 and x2 matches 'length'.
 * 
 * Uses Newton-Raphson method to solve: sqrt(s^2 - v^2) = 2a * sinh(h / 2a)
 * where s = length, v = vertical distance (y2-y1), h = horizontal distance (x2-x1).
 */
/**
 * Solves the catenary equation for the given constraints.
 * 
 * A catenary is defined by y = a * cosh((x - offset) / a) + C
 * We need to find 'a' (the catenary parameter) such that the curve length between x1 and x2 matches 'length'.
 * 
 * Uses Newton-Raphson method to solve: sqrt(s^2 - v^2) = 2a * sinh(h / 2a)
 * where s = length, v = vertical distance (y2-y1), h = horizontal distance (x2-x1).
 */
export function solveCatenary(x1, y1, x2, y2, length) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // If the chain is taut (or impossible), return a straight line approximation properties
    if (dist >= length - 0.01) {
        return {
            a: 0, // Infinite tension theoretically, but we flag it as straight
            isStraight: true,
            tensionX: 0, // Handled by elastic logic elsewhere
            maxSag: 0,
            drawPoints: [{x: x1, y: y1}, {x: x2, y: y2}]
        };
    }

    // Horizontal distance
    const h = Math.max(0.001, Math.abs(dx));
    const v = dy; 

    // CASE: Vertical Hang (Anchor extremely close to boat horizontally, but plenty of slack)
    // The standard solver fails here because h -> 0 implies a -> 0 and cosh -> Infinity.
    // We approximate this as two vertical lines meeting at a nadir.
    if (h < 4.0) {
        // In Canvas coords (Y down), the lowest point y_nadir satisfies:
        // Length = (y_nadir - y1) + (y_nadir - y2)
        // L = 2*y_nadir - y1 - y2
        // y_nadir = (L + y1 + y2) / 2
        
        const yNadir = (length + y1 + y2) / 2;
        const xMid = (x1 + x2) / 2;
        
        const points = [];
        points.push({x: x1, y: y1});
        // Add a few points down to nadir
        points.push({x: x1, y: (y1 + yNadir) * 0.5});
        points.push({x: xMid, y: yNadir}); // The bottom
        points.push({x: x2, y: (y2 + yNadir) * 0.5});
        points.push({x: x2, y: y2});
        
        return {
            a: 0.1, // Dummy
            isStraight: false,
            drawPoints: points,
            p: xMid,
            q: yNadir
        };
    }

    // Equation to solve for z (where z = h / 2a):
    // sinh(z) / z = sqrt(length^2 - v^2) / h
    const rhs = Math.sqrt(length * length - v * v) / h;
    
    // Newton-Raphson to find z
    // f(z) = sinh(z)/z - rhs
    // f'(z) = (z*cosh(z) - sinh(z)) / z^2
    let z = 1.0; // Initial guess
    
    // If rhs is very large (deep loop), z will be large.
    // sinh(z)/z approx exp(z)/2z. 
    // Optimization: if rhs > 50, start guess higher.
    if (rhs > 100) z = 6.0;

    for (let i = 0; i < 20; i++) {
        const sinhZ = Math.sinh(z);
        const coshZ = Math.cosh(z);
        const f = (sinhZ / z) - rhs;
        if (Math.abs(f) < 0.001) break;
        
        const df = (z * coshZ - sinhZ) / (z * z);
        // Avoid zero deriv (shouldn't happen for z>0)
        if (Math.abs(df) < 1e-9) break; 
        
        let dz = f / df;
        // Dampen step if huge
        if (Math.abs(dz) > 1.0) dz = Math.sign(dz) * 1.0;
        
        z = z - dz;
        if (z < 0.01) z = 0.01; // Clamp
    }
    
    // Calculate parameter a
    // z = h / 2a  =>  2a = h / z  =>  a = h / 2z
    const a = h / (2 * z);

    // Now we need to find the offsets (p, q) such that the curve passes through (x1, y1)
    // y = a * cosh((x - p) / a) + q
    
    const val = (length + v) / (length - v);
    // Safety check for log
    const shiftX = (val <= 0) ? 0 : a * Math.log(val);
    const p = (x1 + x2 - shiftX) / 2;
    const q = y2 - a * Math.cosh((x2 - p) / a);
    
    // Generate drawing points
    const points = [];
    const segments = length > 500 ? 50 : 30;
    
    for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const cx = x1 + (x2 - x1) * t;
        const cy = a * Math.cosh((cx - p) / a) + q;
        points.push({x: cx, y: cy});
    }

    return {
        a: a,
        isStraight: false,
        p: p, 
        q: q,
        drawPoints: points
    };
}
