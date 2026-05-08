import ctypes
import os
import time
import logging
from typing import Optional, Tuple, Dict, Any

logger = logging.getLogger(__name__)

# FOCAS Error Codes (from Fwlib64.h)
EW_OK = 0
EW_BUFFER = 10
EW_RESET = -2
EW_DATA = 5
EW_OVRFLOW = 8
EW_PROT = 7
EW_REJECT = 13
EW_ALARM = 15

class FocasError(Exception):
    def __init__(self, code: int, message: str):
        self.code = code
        self.message = f"{message} (Error Code: {code})"
        super().__init__(self.message)

class FOCAS_DATE(ctypes.Structure):
    """Date structure for FOCAS directory listings"""
    _fields_ = [
        ("year", ctypes.c_short),
        ("month", ctypes.c_short),
        ("day", ctypes.c_short),
        ("hour", ctypes.c_short),
        ("minute", ctypes.c_short),
        ("dummy", ctypes.c_short)
    ]

class PRGDIR3(ctypes.Structure):
    """C-Structure for cnc_rdprogdir3"""
    _fields_ = [
        ("number", ctypes.c_long),
        ("length", ctypes.c_long),
        ("page", ctypes.c_long),
        ("comment", ctypes.c_char * 52),
        ("mdate", FOCAS_DATE),
        ("cdate", FOCAS_DATE)
    ]

class FocasClientBase:
    """Abstract base class for Dependency Injection"""
    def connect(self, ip: str, port: int = 8193, timeout: int = 10) -> bool:
        raise NotImplementedError
    def disconnect(self):
        raise NotImplementedError
    def set_path(self, path_no: int):
        raise NotImplementedError
    def download_program(self, program_text: str, path_no: int = 0):
        raise NotImplementedError
    def upload_program(self, prog_num: int, path_no: int = 0) -> str:
        raise NotImplementedError
    def list_programs(self, path_no: int = 0) -> list:
        raise NotImplementedError

class DummyFocasClient(FocasClientBase):
    """Dummy FOCAS client for testing without a CNC or DLLs."""
    def __init__(self):
        self.connected = False
        
    def connect(self, ip: str, port: int = 8193, timeout: int = 10) -> bool:
        logger.info(f"[DUMMY] Connecting to {ip}:{port}")
        self.connected = True
        return True
        
    def disconnect(self):
        logger.info("[DUMMY] Disconnected")
        self.connected = False
        
    def set_path(self, path_no: int):
        logger.info(f"[DUMMY] Path set to {path_no}")
        
    def download_program(self, program_text: str, path_no: int = 0):
        logger.info(f"[DUMMY] Downloading {len(program_text)} bytes to Path {path_no}")
        time.sleep(0.5) # Simulate transfer time
        
    def upload_program(self, prog_num: int, path_no: int = 0) -> str:
        logger.info(f"[DUMMY] Uploading O{prog_num} from Path {path_no}")
        time.sleep(0.5) # Simulate transfer time
        return f"\nO{prog_num}\n(DUMMY DATA FOR PATH {path_no})\nG0 X0 Z0;\nM30\n%"

    def list_programs(self, path_no: int = 0) -> list:
        logger.info(f"[DUMMY] Listing programs for Path {path_no}")
        return [
            {"number": 1000, "length": 250, "comment": "MAIN PART A"},
            {"number": 1001, "length": 450, "comment": "MAIN PART B"},
            {"number": 1002, "length": 1500, "comment": "FINISHING"}
        ]

class RealFocasClient(FocasClientBase):
    def __init__(self, dll_path: str = "focas_dlls/FWLIB64.DLL"):
        self.lib = None
        self.handle = ctypes.c_ushort(0)
        
        # Resolve absolute path relative to this file's dir
        base_dir = os.path.dirname(os.path.abspath(__file__))
        dll_dir = os.path.dirname(os.path.join(base_dir, dll_path))
        abs_dll_path = os.path.join(base_dir, dll_path)
        
        # In Python 3.8+ on Windows, DLL resolution requires explicitly adding the directory
        if hasattr(os, 'add_dll_directory') and os.name == 'nt':
            try:
                os.add_dll_directory(dll_dir)
            except Exception as e:
                logger.warning(f"Could not add DLL directory {dll_dir}: {e}")

        try:
            # Try to load the 64-bit library
            self.lib = ctypes.cdll.LoadLibrary(abs_dll_path)
            self._setup_prototypes()
            logger.info(f"Successfully loaded FOCAS library: {abs_dll_path}")
        except OSError as e:
            logger.error(f"Could not load FOCAS library {abs_dll_path}. Ensure it is inside backend/focas_dlls: {e}")

    def _setup_prototypes(self):
        """Define argument types and return types for safety."""
        if not self.lib:
            return
            
        # Connect & Disconnect
        self.lib.cnc_allclibhndl3.argtypes = [ctypes.c_char_p, ctypes.c_ushort, ctypes.c_long, ctypes.POINTER(ctypes.c_ushort)]
        self.lib.cnc_allclibhndl3.restype = ctypes.c_short
        
        self.lib.cnc_freelibhndl.argtypes = [ctypes.c_ushort]
        self.lib.cnc_freelibhndl.restype = ctypes.c_short

        # Multi-channel Path operations
        self.lib.cnc_setpath.argtypes = [ctypes.c_ushort, ctypes.c_short]
        self.lib.cnc_setpath.restype = ctypes.c_short
        
        self.lib.cnc_getpath.argtypes = [ctypes.c_ushort, ctypes.POINTER(ctypes.c_short), ctypes.POINTER(ctypes.c_short)]
        self.lib.cnc_getpath.restype = ctypes.c_short

        # Download (PC -> CNC)
        self.lib.cnc_dwnstart3.argtypes = [ctypes.c_ushort, ctypes.c_short]
        self.lib.cnc_dwnstart3.restype = ctypes.c_short
        
        self.lib.cnc_download3.argtypes = [ctypes.c_ushort, ctypes.POINTER(ctypes.c_long), ctypes.c_char_p]
        self.lib.cnc_download3.restype = ctypes.c_short
        
        self.lib.cnc_dwnend3.argtypes = [ctypes.c_ushort]
        self.lib.cnc_dwnend3.restype = ctypes.c_short

        # Upload (CNC -> PC)
        self.lib.cnc_upstart3.argtypes = [ctypes.c_ushort, ctypes.c_short, ctypes.c_long, ctypes.c_long]
        # Directory / Read Programs
        self.lib.cnc_rdprogdir3.argtypes = [ctypes.c_ushort, ctypes.c_short, ctypes.POINTER(ctypes.c_long), ctypes.POINTER(ctypes.c_short), ctypes.c_void_p]
        self.lib.cnc_rdprogdir3.restype = ctypes.c_short

        self.lib.cnc_upstart3.restype = ctypes.c_short
        
        self.lib.cnc_upload3.argtypes = [ctypes.c_ushort, ctypes.POINTER(ctypes.c_long), ctypes.c_char_p]
        self.lib.cnc_upload3.restype = ctypes.c_short
        
        self.lib.cnc_upend3.argtypes = [ctypes.c_ushort]
        self.lib.cnc_upend3.restype = ctypes.c_short

    def connect(self, ip: str, port: int = 8193, timeout: int = 10) -> bool:
        if not self.lib:
            raise RuntimeError("FOCAS Library not loaded")
            
        ip_encoded = ip.encode('ascii')
        
        # Free previous handle if it exists before trying to allocate a new one
        if self.handle.value != 0:
            self.disconnect()

        # FWLIB64 dynamically loads fwlibe64.dll and other dependencies without absolute paths during cnc_allclibhndl3.
        # We must temporarily change the process working directory so Windows can find them.
        old_cwd = os.getcwd()
        focas_dir = os.path.dirname(os.path.abspath(self.lib._name))
        
        try:
            os.chdir(focas_dir)
            ret = self.lib.cnc_allclibhndl3(ip_encoded, port, timeout, ctypes.byref(self.handle))
        finally:
            os.chdir(old_cwd)

        if ret != EW_OK:
            logger.error(f"FOCAS Connection Error to {ip}:{port}. Code: {ret}")
            return False
        return True

    def disconnect(self):
        if self.lib and self.handle.value != 0:
            self.lib.cnc_freelibhndl(self.handle)
            self.handle.value = 0

    def set_path(self, path_no: int):
        if path_no == 0:
            return  # Default
            
        ret = self.lib.cnc_setpath(self.handle, path_no)
        if ret != EW_OK:
            raise FocasError(ret, f"Failed to set FOCAS path to {path_no}")

    def download_program(self, program_text: str, path_no: int = 0):
        self.set_path(path_no)
        
        if not program_text.startswith("\n"): program_text = "\n" + program_text
        if not program_text.strip().endswith("%"): program_text = program_text.rstrip() + "\n%"
            
        raw_data = program_text.encode('ascii', errors='ignore')
        
        ret = self.lib.cnc_dwnstart3(self.handle, 0)
        if ret != EW_OK: raise FocasError(ret, "Failed to start download sequence (cnc_dwnstart3)")

        try:
            while len(raw_data) > 0:
                chunk_len = ctypes.c_long(len(raw_data))
                ret = self.lib.cnc_download3(self.handle, ctypes.byref(chunk_len), raw_data)
                
                if ret == EW_BUFFER:
                    time.sleep(0.1)
                    continue
                elif ret == EW_OK:
                    raw_data = raw_data[chunk_len.value:]
                else:
                    raise FocasError(ret, f"Error during data transfer loop (cnc_download3)")
        finally:
            end_ret = self.lib.cnc_dwnend3(self.handle)
            if end_ret != EW_OK: logger.warning(f"cnc_dwnend3 returned non-zero during cleanup: {end_ret}")

    def upload_program(self, prog_num: int, path_no: int = 0) -> str:
        self.set_path(path_no)
        
        ret = self.lib.cnc_upstart3(self.handle, 0, prog_num, prog_num)
        if ret != EW_OK: raise FocasError(ret, f"Failed to start upload for program O{prog_num}")
            
        buf_size = 1280
        buffer = ctypes.create_string_buffer(buf_size + 1)
        result_text = []
        
        try:
            while True:
                length = ctypes.c_long(buf_size)
                ret = self.lib.cnc_upload3(self.handle, ctypes.byref(length), buffer)
                
                if ret == EW_BUFFER:
                    time.sleep(0.05)
                    continue
                    
                if ret == EW_OK:
                    chunk_str = buffer.raw[:length.value].decode('ascii', errors='ignore')
                    result_text.append(chunk_str)
                    if "%" in chunk_str: break
                elif ret == EW_RESET:
                    break
                else:
                    raise FocasError(ret, "Error during data receive loop (cnc_upload3)")
        finally:
            end_ret = self.lib.cnc_upend3(self.handle)
            if end_ret != EW_OK: logger.warning(f"cnc_upend3 returned non-zero during cleanup: {end_ret}")
        return "".join(result_text)

    def list_programs(self, path_no: int = 0) -> list:
        self.set_path(path_no)
        
        MAX_PROG = 10
        prgdir_array = (PRGDIR3 * MAX_PROG)()
        top_prog = ctypes.c_long(0)
        
        programs = []
        
        while True:
            num_prog = ctypes.c_short(MAX_PROG)
            # type 2 = read prog number, length, comment, and date
            ret = self.lib.cnc_rdprogdir3(self.handle, 2, ctypes.byref(top_prog), ctypes.byref(num_prog), ctypes.byref(prgdir_array))
            
            if ret == EW_OK:
                for i in range(num_prog.value):
                    prog = prgdir_array[i]
                    comment = prog.comment.decode('ascii', errors='ignore').strip('\x00').strip()
                    programs.append({
                        "number": prog.number,
                        "length": prog.length,
                        "comment": comment
                    })
                
                if num_prog.value < MAX_PROG:
                    break  # Read all programs
                else:
                    # Set up to read the next batch
                    top_prog.value = prgdir_array[MAX_PROG - 1].number + 1
            else:
                # EW_DATA (no program found), or other error stops the loop
                break
                
        return programs

# Dependency Injection setup
USE_MOCK = os.environ.get("USE_MOCK_FOCAS", "0") == "1"

# Initialize a global instance based on environment variable
# You can set USE_MOCK_FOCAS=1 in your environment/docker-compose to use the mock DLLs.
_focas_instance = DummyFocasClient() if USE_MOCK else RealFocasClient()

def get_focas_client() -> FocasClientBase:
    """FastAPI Dependency for FOCAS operations"""
    return _focas_instance
