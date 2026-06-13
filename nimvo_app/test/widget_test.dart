import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('renders a material smoke screen', (WidgetTester tester) async {
    await tester.pumpWidget(const MaterialApp(home: Text('Nimvo')));
    await tester.pump();

    expect(find.text('Nimvo'), findsOneWidget);
  });
}
