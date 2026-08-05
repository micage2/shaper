
I'm still working with the full index.html you glued earlier for debugging.
Have to separate it class by class now. Styles are a problem: which rule belongs to which class?

The codebase is growing and modularization is crucial for our communication and also for code maintenance. Having components with clear interfaces is the way to go. This is also important style encapsulation.

This way we have much smaller fish to fry. Sorry, smaller tasks/problems to handle.

Product vs Products

Talk about id vs name again

Priorities (in this order):
- model integrity
- view synchronization (proper MVC pattern)
- selection class (multi-selection, sync aross views where possible: TreeView <-> TableView, selection-based operations)
- styles (layout related first, than color, fonts, sizes, ...)
- quality of live (drag/drop, copy/paste)

