from typing import List, Type, Any, Optional

from ncplot7py.domain.exec_chain import Handler

class HandlerChainBuilder:
    """Builder for constructing a Chain of Responsibility for CNC handlers.
    
    Handlers are added in the order they should execute (first added = first executed).
    The builder automatically wires them together from last to first when build() is called.
    """
    
    def __init__(self):
        self._handlers: List[Type[Handler] | Any] = []

    def add(self, handler: Type[Handler] | Any) -> "HandlerChainBuilder":
        """Adds a handler class to the end of the chain (it will be executed after all previously added handlers).
        
        Args:
            handler: Either a Handler class (which will be automatically instantiated) 
                     or an already instantiated Handler object.
        """
        self._handlers.append(handler)
        return self

    def add_if_importable(self, module_path: str, class_name: str) -> "HandlerChainBuilder":
        """Attempts to dynamically import and add a handler class to the sequence.
        If the import fails, it silently skips it, acting as a fallback mechanism.
        """
        import importlib
        try:
            module = importlib.import_module(module_path)
            handler_class = getattr(module, class_name)
            self._handlers.append(handler_class)
        except (ImportError, AttributeError):
            pass
        return self

    def build(self) -> Optional[Handler]:
        """Wires up the added handlers in reverse order.
        
        Returns:
            The first Handler in the chain (head), or None if the chain is empty.
        """
        current_next = None
        # Wire from end of list back to the start
        for handler_entry in reversed(self._handlers):
            if isinstance(handler_entry, type):
                # It's an uninstantiated class
                current = handler_entry(next_handler=current_next)
            else:
                # It's an already instantiated object
                current = handler_entry
                if hasattr(current, 'next_handler'):
                    current.next_handler = current_next
            current_next = current
            
        return current_next