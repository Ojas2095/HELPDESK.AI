/**
 * Unified Date Utility for HELPDESK.AI
 * Fixes timezone shift issues by explicitly forcing local display.
 */

export const parseDate = (dateVal) => {
    if (dateVal === null || dateVal === undefined) return null;
    if (dateVal instanceof Date) {
        return isNaN(dateVal.getTime()) ? null : dateVal;
    }
    
    let str = String(dateVal).trim();
    if (str === '') return null;
    
    // Check if it's a purely numeric timestamp (epoch milliseconds)
    if (/^\d+$/.test(str)) {
        const timestamp = parseInt(str, 10);
        const date = new Date(timestamp);
        return isNaN(date.getTime()) ? null : date;
    }

    // Normalization for Safari:
    // Safari fails on "YYYY-MM-DD HH:mm:ss.SSSSSS" or "YYYY-MM-DD HH:mm:ss+00"
    // Replace space between date and time with 'T' if it looks like a date string
    // "2024-05-19 15:28:36" -> "2024-05-19T15:28:36"
    if (str.includes(' ') && !str.includes('T')) {
        str = str.replace(' ', 'T');
    }

    // Check if it's a date with slashes YYYY/MM/DD
    // If it's like YYYY/MM/DD or YYYY/M/D, replace slashes with hyphens
    // e.g. "2024/01/15" -> "2024-01-15"
    if (str.includes('/')) {
        str = str.replace(/\//g, '-');
    }
    
    // If it has a time component (contains ':') and lacks timezone info, append 'Z'
    // Timezone info: Z, or +/- followed by digits at the end
    const timezoneRegex = /(Z|[+-]\d{2}(?::?\d{2})?)$/;
    if (str.includes(':') && !timezoneRegex.test(str)) {
        str += 'Z';
    }
    
    // Attempt standard parse first after normalization
    let date = new Date(str);
    if (!isNaN(date.getTime())) return date;
    
    // Explicit manual components extraction for ISO/Supabase formats Safari still fails to parse
    const regex = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{1,2}):(\d{1,2})(?:\.(\d+))?)?(?:Z|([+-]\d{1,2})(?::?(\d{2}))?)?$/;
    const match = str.match(regex);
    if (match) {
        const year = parseInt(match[1], 10);
        const month = parseInt(match[2], 10) - 1; // 0-indexed
        const day = parseInt(match[3], 10);
        
        // Month validation: month must be between 0 and 11
        if (month < 0 || month > 11) return null;
        
        const hour = match[4] ? parseInt(match[4], 10) : 0;
        const minute = match[5] ? parseInt(match[5], 10) : 0;
        const second = match[6] ? parseInt(match[6], 10) : 0;
        
        let ms = 0;
        if (match[7]) {
            ms = parseInt(match[7].substring(0, 3).padEnd(3, '0'), 10);
        }
        
        const hasTimezone = str.includes('Z') || match[8];
        let computedDate;
        if (hasTimezone) {
            if (str.includes('Z')) {
                computedDate = new Date(Date.UTC(year, month, day, hour, minute, second, ms));
            } else {
                const offsetSign = match[8].startsWith('-') ? -1 : 1;
                const offsetHours = parseInt(match[8].substring(1, 3), 10);
                const offsetMinutes = match[9] ? parseInt(match[9], 10) : 0;
                
                const utcTime = Date.UTC(year, month, day, hour, minute, second, ms) - (offsetSign * (offsetHours * 60 + offsetMinutes) * 60 * 1000);
                computedDate = new Date(utcTime);
            }
        } else {
            // If no timezone specified, assume UTC (matching original backend raw string behavior)
            computedDate = new Date(Date.UTC(year, month, day, hour, minute, second, ms));
        }
        
        // Validate date values to prevent rollover (e.g., 2024-13-45)
        if (isNaN(computedDate.getTime())) return null;
        
        // If no timezone offset, the day/month/year of UTC representation should match parsed values
        if (!hasTimezone) {
            if (computedDate.getUTCFullYear() !== year ||
                computedDate.getUTCMonth() !== month ||
                computedDate.getUTCDate() !== day) {
                return null;
            }
        }
        
        return computedDate;
    }
    
    return null;
};

export const safeParseDate = (dateStr) => {
    return parseDate(dateStr) || new Date();
};

export const formatTimelineDate = (dateStr) => {
    const date = parseDate(dateStr);
    if (!date) return 'Invalid Date';

    // Using the browser's default locale and timeZone (which is the user's local)
    return date.toLocaleString('en-US', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
};

export const isValidDate = (dateStr) => {
    return parseDate(dateStr) !== null;
};

export const getRelativeTime = (dateStr) => {
    const date = parseDate(dateStr);
    if (!date) return 'Unknown';

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 10) {
        return 'Just now';
    }

    if (diffMin < 60) {
        return `${diffMin} ${diffMin === 1 ? 'minute' : 'minutes'} ago`;
    }

    if (diffHour < 24) {
        return `${diffHour} ${diffHour === 1 ? 'hour' : 'hours'} ago`;
    }

    if (diffDay < 30) {
        return `${diffDay} ${diffDay === 1 ? 'day' : 'days'} ago`;
    }

    return formatTimelineDate(dateStr);
};

export const getTimeZoneAbbr = () => {
    try {
        return new Intl.DateTimeFormat('en-US', {
            timeZoneName: 'short'
        })
        .formatToParts(new Date())
        .find(part => part.type === 'timeZoneName')?.value || 'IST';
    } catch (_e) {
        return 'IST';
    }
};

export const formatFullTimestamp = (dateStr) => {
    const date = parseDate(dateStr);
    if (!date) return 'Processing...';
    const formatted = formatTimelineDate(dateStr);
    return `${formatted} (${getTimeZoneAbbr()})`;
};
