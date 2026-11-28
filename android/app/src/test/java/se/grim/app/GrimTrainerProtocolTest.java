package se.grim.app;
import java.util.Arrays;
public class GrimTrainerProtocolTest {
    private static void check(boolean ok,String rule){if(!ok)throw new AssertionError(rule);}
    public static void main(String[] args){
        byte[] b={84,2,(byte)184,11,(byte)170,0,16,39,0,(byte)220,0,(byte)135};
        GrimTrainerProtocol.Reading r=GrimTrainerProtocol.parse(b);
        check(r.speed==30&&r.cadence==85&&r.power==220&&r.distance==10000&&r.heart==135,"optional FTMS fields");
        check(GrimTrainerProtocol.parse(new byte[]{1,0}).power==null,"missing power must stay missing");
        boolean failed=false;try{GrimTrainerProtocol.parse(new byte[]{64,0,0});}catch(Exception e){failed=true;}check(failed,"truncated FTMS packet");
        check(Arrays.equals(GrimTrainerProtocol.command(5,300),new byte[]{5,44,1}),"target power");
        check(Arrays.equals(GrimTrainerProtocol.command(17,400),new byte[]{17,0,0,(byte)144,1,40,51}),"indoor simulation complete payload");
        check(Arrays.equals(GrimTrainerProtocol.command(8,2),new byte[]{8,2}),"pause differs from reset");
        check(GrimTrainerProtocol.heartTarget(249,100.0,1000,85.0,135,250,25)==250,"HR power cap");
        check(GrimTrainerProtocol.heartTarget(200,null,1000,85.0,135,250,25)==50,"missing HR lowers power");
        check(GrimTrainerProtocol.heartTarget(200,100.0,11000,85.0,135,250,25)==50,"stale HR lowers power");
        check(GrimTrainerProtocol.heartTarget(200,100.0,1000,0.0,135,250,25)==50,"stopped pedals lower power");
        System.out.println("10 native FTMS/safety checks passed");
    }
}
