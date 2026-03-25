import React, { useState } from 'react';

interface TooltipProps {
    content: string;
    children: React.ReactNode;
    position?: 'top' | 'bottom' | 'left' | 'right';
}

const Tooltip: React.FC<TooltipProps> = ({ content, children, position = 'top' }) => {
    const [show, setShow] = useState(false);

    const positionClasses = {
        top: 'bottom-full left-1/2 transform -translate-x-1/2 mb-2',
        bottom: 'top-full left-1/2 transform -translate-x-1/2 mt-2',
        left: 'right-full top-1/2 transform -translate-y-1/2 mr-2',
        right: 'left-full top-1/2 transform -translate-y-1/2 ml-2',
    };

    const arrowClasses = {
        top: 'top-full left-1/2 transform -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900',
        bottom: 'bottom-full left-1/2 transform -translate-x-1/2 -mb-1 border-4 border-transparent border-b-gray-900',
        left: 'left-full top-1/2 transform -translate-y-1/2 -ml-1 border-4 border-transparent border-l-gray-900',
        right: 'right-full top-1/2 transform -translate-y-1/2 -mr-1 border-4 border-transparent border-r-gray-900',
    };

    return (
        <div
            className="relative inline-block"
            onMouseEnter={() => setShow(true)}
            onMouseLeave={() => setShow(false)}
            onTouchStart={() => setShow(true)}
            onTouchEnd={() => setTimeout(() => setShow(false), 2000)}
        >
            {children}
            {show && (
                <div
                    className={`absolute ${positionClasses[position]} px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg whitespace-nowrap z-50 pointer-events-none`}
                    style={{ maxWidth: '200px', whiteSpace: 'normal' }}
                >
                    {content}
                    <div className={`absolute ${arrowClasses[position]}`}></div>
                </div>
            )}
        </div>
    );
};

export default Tooltip;
