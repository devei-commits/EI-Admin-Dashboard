

const Sidebar = () => {
    return (
        <div className="w-80 h-screen flex flex-col border border-black">
           
           
            <div className="flex-1 flex flex-col">
                <div className="p-2 flex items-center justify-center border-b border-black">
                    <img src="/src/assets/logo/eilogofull.svg" alt="Logo" className="max-h-10 max-w-full object-contain" />
                </div>


                <div className="bg-red-500 flex-1">
                    first part - bottom
                </div>
            </div>

            <div className="bg-yellow-50 flex-1">
                second part
            </div>

            <div className="bg-blue-50 flex-1">
                third part
            </div>

        </div>
    )
}

export default Sidebar
