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

    // Horizontal distance (must be positive for solver)
    const h = Math.max(0.01, Math.abs(dx));
    // Vertical distance
    const v = dy; 

    // Equation to solve for z (where z = h / 2a):
    // sinh(z) / z = sqrt(length^2 - v^2) / h
    const rhs = Math.sqrt(length * length - v * v) / h;
    
    // Newton-Raphson to find z
    // f(z) = sinh(z)/z - rhs
    // f'(z) = (z*cosh(z) - sinh(z)) / z^2
    let z = 1.0; // Initial guess
    for (let i = 0; i < 10; i++) {
        const sinhZ = Math.sinh(z);
        const coshZ = Math.cosh(z);
        const f = (sinhZ / z) - rhs;
        if (Math.abs(f) < 0.001) break;
        
        const df = (z * coshZ - sinhZ) / (z * z);
        z = z - f / df;
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
    
    // Ensure we draw from x1 to x2 correctly (dx can be negative in boat context)
    // We iterate t from 0 to 1
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
