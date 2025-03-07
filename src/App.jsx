import { useState } from 'react'
import './App.css'
import ImageLoad from './components/ImageLoad'
import logo from './assets/sunArmorLogo2.png'

function App() {
    return (
        <>
            <div className='h-screen justify-center items-center flex flex-col'>
                <div className='flex flex-row items-center space-x-5 justify-center'>
                    <span className='text-3xl sm:text-5xl md:text-7xl font-extrabold font-display text-white'>
                        SUN ARMOR
                    </span>
                    <img
                        src={logo}
                        alt='SunArmor AI'
                        className='w-15 h-15 sm:w-20 sm:h-20 md:w-30 md:h-30 pb-2'
                    />
                </div>
                <div className='sm:pb-5 md:pb-8 flex'>
                    <span className='font-display text-lg sm:text-2xl md:text-3xl color-peach font-semibold'>
                        AI-Powered Skin Cancer Detection
                    </span>
                </div>

                <ImageLoad />
            </div>
        </>
    )
}

export default App
