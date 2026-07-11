"use client"
import { motion, Variants } from 'framer-motion'
import { ArrowRight } from 'lucide-react';
import React, { CSSProperties, FC } from 'react'

interface Props {
  className?: string;
  children?: React.ReactNode;
  title?: string;
  textStyle?: CSSProperties;
  type?: 'lg' | 'md' | 'sm';
  onClick?: () => void;
  disabled?: boolean;
}

export const WobbleButton: FC<Props> = ({ className, children, title, textStyle, type = 'md', onClick, disabled }) => {
  const size = {
    lg: 'w-48 h-48',
    md: 'px-6 py-3',
    sm: 'px-4 py-2 text-sm'
  }

  const buttonParentVariants: Variants = {
    initial: { scaleX: 1, scaleY: 1 },
    hover: { scaleX: 1.03, scaleY: 0.98, transition: { type: 'spring' } },
    tap: { scale: 0.95 }
  };

  const span1Variants: Variants = {
    initial: { x: 0 },
    hover: { x: "100%", transition: { delay: 0.1 } },
  };0

  const span2Variants: Variants = {
    initial: { x: 0 },
    hover: { x: "100%", transition: { delay: 0.2, type: 'spring' } },
  };

  const wobbleVariants: Variants = {
    hover: {
      x: [0, -4, 4, -4, 4, 0],
      transition: { type: "spring", stiffness: 200, damping: 10 },
    },
  };

  return (
    <div className={`inline-block ${className || ''} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
      <motion.button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="rounded-full bg-indigo-950 overflow-hidden relative border-none w-full"
        variants={buttonParentVariants}
        initial="initial"
        whileHover={disabled ? "initial" : "hover"}
        whileTap={disabled ? "initial" : "tap"}
      >
        <motion.span
          className="absolute w-full h-full bg-indigo-800 -left-full block rounded-full"
          variants={span1Variants}
        >
          <motion.div
            className="w-full h-full"
            variants={wobbleVariants}
          ></motion.div>
        </motion.span>
        <motion.span
          className="absolute w-full h-full bg-indigo-600 -left-full block rounded-full"
          variants={span2Variants}
        >
          <motion.div
            className="w-full h-full"
            variants={wobbleVariants}
          ></motion.div>
        </motion.span>
        <span className={`text-white flex ${size[type]} gap-2 items-center justify-center z-10 relative font-semibold`}>
          <span style={textStyle}>{title ?? children}</span>
          <ArrowRight className="w-4 h-4" />
        </span>
      </motion.button>
    </div>
  )
}
