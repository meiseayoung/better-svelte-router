import { pathToRegexp } from "path-to-regexp";
import { getRouterMode } from "./router-mode";

/**
 * Creates a memoized version of a function.
 * @param fn - The function to memoize
 * @returns A memoized version of the function
 * @internal
 */
function memoize<T, R>(fn: (arg: T) => R): (arg: T) => R {
    const cache = new Map<T, R>();
    return (arg: T): R => {
        if (cache.has(arg)) {
            return cache.get(arg)!;
        }
        const result = fn(arg);
        cache.set(arg, result);
        return result;
    };
}

/**
 * Splits a pathname into an array of cumulative path segments.
 * @param pathname - The pathname to split
 * @returns Array of cumulative path segments
 * @internal
 */
function pathname2paths(pathname: string): string[] {
    const paths = pathname.split('/')
    const result: string[] = []
    for (let i = 0; i < paths.length; i++) {
        result.push(((result.at(-1) ?? '') + '/' + paths[i]).replace(/\/\//, '/'))
    }
    return result
}

const memoizePathname2paths = memoize(pathname2paths);

/**
 * Checks if a route pattern matches the current path.
 * Uses the router mode adapter to get the current path.
 * 
 * @param regPath - The route pattern to match against (e.g., '/users/:id')
 * @param realPath - The actual path to check (currently unused, uses current path instead)
 * @returns True if the pattern matches any segment of the current path
 * 
 * @example
 * // Check if current path matches a pattern
 * if (matchPath('/users/:id', '/users/123')) {
 *   console.log('On a user page');
 * }
 * 
 * @deprecated Consider using matchRoute from matcher.ts instead for more accurate matching
 */
export function matchPath(regPath: string, realPath: string): boolean {
    if (regPath === '/') {
        return true
    }
    const reg = pathToRegexp(regPath).regexp
    // Use router mode adapter to get the current path (base path already removed)
    const currentPath = getRouterMode().getCurrentPath();
    const paths = memoizePathname2paths(currentPath)
    return paths.some((path: string) => {
        return Boolean(reg.exec(path))
    })
}
