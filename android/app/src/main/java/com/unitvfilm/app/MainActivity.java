package com.unitvfilm.app;

import android.os.Bundle;
import android.webkit.WebSettings;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // This setting allows media (like YouTube iframe videos) to autoplay in the Android WebView
        this.bridge.getWebView().getSettings().setMediaPlaybackRequiresUserGesture(false);
    }
}
